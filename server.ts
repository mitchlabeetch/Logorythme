import express from "express";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import sharp from "sharp";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import sizeOf from "image-size";
import rateLimit from "express-rate-limit";
import crypto from "crypto";

import { XMLParser, XMLValidator } from "fast-xml-parser";
import { optimize } from "svgo";
import winston from "winston";

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'app.log' }),
  ],
});

// Centralized error handling to prevent sandbox crashes
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err}`);
});
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
});

dotenv.config();

const app = express();

app.get('/api/auth/url', (req, res) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectUri = `${protocol}://${host}/auth/callback`;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || 'PENDING',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline'
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  res.json({ url: authUrl });
});

app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  const code = req.query.code as string;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectUri = `${protocol}://${host}/auth/callback`;

  let userData: { name: string; picture?: string } = { name: 'Authenticated User' };

  if (code && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const tokenData = await tokenResponse.json();
      
      if (tokenData.access_token) {
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userInfo = await userResponse.json();
        if (userInfo.name) {
          userData.name = userInfo.name;
        }
        if (userInfo.picture) {
          userData.picture = userInfo.picture;
        }
      }
    } catch (e) {
      logger.error('Error exchanging oauth token: ' + e);
    }
  }

  res.send(`
    <html><body><script>
      if (window.opener) {
        window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user: ${JSON.stringify(userData)} }, '*');
        window.close();
      } else { window.location.href = '/'; }
    </script><p>Authentication successful. You may close this window.</p></body></html>
  `);
});

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});
const PORT = 3000;

// Setup rate limiter
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  statusCode: 429,
  message: { error: "Too many requests from this IP, please try again after an hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Setup multer
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const validMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (validMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG, JPG, and WEBP are allowed.'));
    }
  }
});

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const SYSTEM_INSTRUCTION = (options: any) => `You are a world-class, elite vector graphics AI engine. Your sole objective is to surgically trace the provided raster image and reconstruct it into a production-ready, mathematically pristine SVG.\n\nCRITICAL DIRECTIVES:\n1. MATHEMATICAL PRECISION: Trace all shapes with exact geometric mastery. Completely eliminate wobbly, shaky, or imprecise lines. Employ minimal, mathematically optimal Bezier curves and utilize geometric primitives (<circle>, <rect>, <polygon>) wherever structurally sound.\n2. FLAWLESS PATH LOGIC: You MUST use proper SVG fill rules (e.g., \`fill-rule=\"evenodd\"\`) to elegantly handle compound paths, donut-holes, and precise cutouts. Do NOT use crude overlapping patches.\n3. TRANSPARENT BACKGROUND: ABOLISH solid background rectangles. The overarching canvas MUST be transparent. Only include backgrounds if they are inextricably part of the logo's intrinsic design.\n4. SEMANTIC HIERARCHY & ACCESSIBILITY: Group structurally related paths within \`<g>\` tags. Maintain absolute strictness with z-depth layering, from back (bottom) to front (top). You MUST include proper accessibility attributes on the root \`<svg>\` element (e.g. \`role=\"img\"\`, \`aria-label=\"Image description\"\`, \`tabindex=\"0\"\`) and provide a descriptive \`<title>\` and \`<desc>\` element right inside the SVG root to ensure screen-reader compatibility.\n5. MANDATORY LAYER NAMING: EVERY distinct semantic part MUST be wrapped in a \`<g>\` tag containing a highly descriptive \`data-name=\"Your Element Name\"\`. Example: <g data-name=\"Inner Ring\">. This is NON-NEGOTIABLE. Without this, the UI layer editor will catastrophically fail.\n6. SCALABILITY: Define a precise, tight bounding \`viewBox\` (e.g., \`viewBox=\"0 0 500 500\"\`). Do NOT hardcode fixed pixel width/height without an accompanying viewBox.\n7. DETAIL PROFILE [${(options.quality || 'high').toUpperCase()}]: ${  options.quality === 'minimal' ? 'Extremist Minimalism. Vigorously simplify shapes, ruthlessly flatten gradients into solid colors, and eradicate micro-noise. Output the absolute lowest possible anchor count while retaining core recognition.'   : options.quality === 'optimized' ? 'Supreme Optimization. Strike an immaculate balance between high visual fidelity and lean, clean path data.'   : 'Hyper-Fidelity. Yield a flawless, pixel-perfect, exhaustively detailed vector tracing. Maintain razor-sharp anchor placement and meticulous curve fitting.'}\n${(options.forceWhite === 'true' || options.forceWhite === true) ? '8. COLOR INJECTION: YOU MUST FORCE EVERY EXPOSED PATH, SHAPE, AND POLYGON TO BE PURE WHITE (#FFFFFF). NO OTHER COLORS ARE PERMITTED.\n9.' : '8.'} CLEAN STYLING: Enforce inline attributes (\`fill=\"...\"\`, \`stroke=\"...\"\`). FORBID the use of global \`<style>\` blocks that pollute the DOM. Guarantee all numerical coordinates are pristine and valid.\n${(options.forceWhite === 'true' || options.forceWhite === true) ? '10.' : '9.'} ABSOLUTE ZERO FORMATTING: Output EXCLUSIVELY raw, valid XML/SVG code. Start with \`<svg>\` and end with \`</svg>\`. ZERO markdown (\`\`\`svg). ZERO conversational text. ZERO HTML wrappers. Your response must be parsed immediately by a strict XML parser.\nFailure to follow these directives will result in system failure. Act as the ultimate vectorization compiler.`;

// Define Custom Errors
class AIError extends Error {
  type = 'AIError';
  constructor(message: string) { super(message); this.name = 'AIError'; }
}

class SVGValidationError extends Error {
  type = 'SVGValidationError';
  constructor(message: string) { super(message); this.name = 'SVGValidationError'; }
}

class ImageProcessingError extends Error {
  type = 'ImageProcessingError';
  constructor(message: string) { super(message); this.name = 'ImageProcessingError'; }
}

// Image Cache with TTL
interface CacheEntry {
  resultBase64: string;
  svgBase64: string;
  timestamp: number;
}
const imageCache = new Map<string, CacheEntry>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface OptimizeOptions {
  simplifyPaths?: boolean;
  removeMetadata?: boolean;
  pathFitting?: boolean;
  strokeOpt?: boolean;
  colorQuant?: boolean | string;
  forceWhite?: boolean | string;
  quality?: string;
  model?: string;
}

// SVG Validation and Clean Function
function cleanAndValidateSVG(rawSvg: string, options: OptimizeOptions = {}): string {
  let cleanSvg = rawSvg;
  const markdownRegex = /```(?:svg|html)?\n([\s\S]*?)```/;
  const match = cleanSvg.match(markdownRegex);
  if (match && match[1]) {
    cleanSvg = match[1].trim();
  } else {
    cleanSvg = cleanSvg.trim();
  }

  if (!cleanSvg.startsWith("<svg") && !cleanSvg.startsWith("<?xml")) {
    throw new SVGValidationError("Output did not look like an SVG.");
  }

  const validationResult = XMLValidator.validate(cleanSvg);
  if (validationResult !== true) {
    const errorDetails = (validationResult as any).err;
    const errMsg = errorDetails?.msg || 'Invalid XML structure';
    const line = errorDetails?.line || 'Unknown';
    throw new SVGValidationError(`AI generated malformed SVG at line ${line}: ${errMsg}.`);
  }

  const parser = new XMLParser({ ignoreAttributes: false });
  const parsedData = parser.parse(cleanSvg);
  if (!parsedData.svg) {
    throw new SVGValidationError("The AI response did not contain a valid <svg> root element.");
  }

  // Basic validation check for potentially malicious content or invalid structures
  const maliciousTags = ['script', 'foreignobject', 'iframe', 'object', 'embed', 'image'];
  const checkMaliciousTags = (obj: any) => {
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (maliciousTags.includes(key.toLowerCase().replace(/^[^a-z]+/, ''))) {
           throw new SVGValidationError(`Blocked potentially malicious SVG tag: ${key}`);
        }
        checkMaliciousTags(obj[key]);
      }
    }
  };
  checkMaliciousTags(parsedData);

  let result;
  try {
    const overrides: any = {};
    if (options.removeMetadata) {
      overrides.removeTitle = true;
      overrides.removeDesc = true;
      overrides.removeMetadata = true;
    } else {
      overrides.removeTitle = false;
      overrides.removeDesc = false;
      overrides.removeMetadata = false;
    }
    
    if (options.simplifyPaths) {
      overrides.convertPathData = { floatPrecision: options.pathFitting ? 1 : 3, applyTransforms: true };
    } else {
      overrides.convertPathData = false;
    }

    if (options.strokeOpt) {
      overrides.convertShapeToPath = true;
      overrides.mergePaths = true;
    } else {
      overrides.convertShapeToPath = false;
      overrides.mergePaths = false;
    }
    
    if (options.colorQuant) {
      overrides.convertColors = { currentColor: false, names2hex: true, rgb2hex: true, shorthex: true };
    }

    const plugins: any[] = [
      {
        name: 'preset-default',
        params: { overrides }
      },
      'convertStyleToAttrs',
      'inlineStyles',
    ];

    if (options.forceWhite === 'true' || options.forceWhite === true) {
      plugins.push({
        name: 'forceWhiteColors',
        type: 'visitor',
        fn: () => {
          return {
            element: {
              enter: (node: any) => {
                if (node.attributes.fill && node.attributes.fill !== 'none') {
                  node.attributes.fill = '#FFFFFF';
                } else if (!node.attributes.fill && ['path', 'circle', 'rect', 'polygon', 'ellipse', 'polyline'].includes(node.name)) {
                  node.attributes.fill = '#FFFFFF';
                }
                if (node.attributes.stroke && node.attributes.stroke !== 'none') {
                  node.attributes.stroke = '#FFFFFF';
                }
              }
            }
          };
        }
      });
    }

    result = optimize(cleanSvg, {
      multipass: options.pathFitting ? true : false,
      plugins: plugins,
    });
  } catch (err: any) {
    throw new SVGValidationError(`SVGO optimization failed: ${err.message}`);
  }

  return result.data;
}

// Setup Mock BullMQ Queue and Worker to prevent sandbox crashes without a real Redis server
const jobsStore = new Map<string, any>();

class MockQueue {
  constructor(public name: string) {}
  async add(name: string, data: any, opts: any) {
    const job = { id: opts.jobId, data, state: 'wait', returnvalue: null, failedReason: null };
    jobsStore.set(opts.jobId, job);
    // Trigger worker asynchronously
    setTimeout(() => mockWorkerProcessor(job), 100);
    return job;
  }
  async getJob(jobId: string) {
    const job = jobsStore.get(jobId);
    if (!job) return null;
    return {
      ...job,
      getState: async () => job.state,
    };
  }
  async getJobCounts(...states: string[]) {
    const counts: any = { wait: 0, active: 0, completed: 0, failed: 0 };
    for (const job of jobsStore.values()) {
      if (counts[job.state] !== undefined) counts[job.state]++;
    }
    return counts;
  }
  on(event: string, handler: any) {}
}

const logoQueue = new MockQueue('logo-processing');

// Background processor logic
const mockWorkerProcessor = async (job: any) => {
  job.state = 'active';
  try {
    const result = await logoWorkerProcessor({ data: job.data });
    job.state = 'completed';
    job.returnvalue = result;
  } catch (error: any) {
    job.state = 'failed';
    // Match BullMQ's failedReason mapping logic for our error serialization
    job.failedReason = error.message || String(error);
  }
};

const logoWorkerProcessor = async (job: any) => {
  const { imageBase64, mimetype, hash, jobId, options } = job.data;
  logger.info(`Started processing job ${jobId}`);
  
  try {
    const aiResponseStream = await ai.models.generateContentStream({
      model: options.model || "gemini-3.1-pro-preview",
      contents: [
        {
          inlineData: {
            mimeType: mimetype,
            data: imageBase64,
          }
        },
        "Convert this logo to SVG according to your system instructions."
      ],
      config: {
        temperature: 0.0,
        systemInstruction: SYSTEM_INSTRUCTION(options),
      }
    });

    let rawSvg = "";
    for await (const chunk of aiResponseStream) {
       rawSvg += chunk.text;
    }
    
    if (!rawSvg) {
       throw new AIError("Gemini generated an empty response or hit a safety filter. Please try another image.");
    }

    const cleanedSvg = cleanAndValidateSVG(rawSvg, options);

    let pngBuffer;
    try {
      const svgBuffer = Buffer.from(cleanedSvg, "utf-8");
      pngBuffer = await sharp(svgBuffer)
        .trim()
        .resize({ width: 2000, withoutEnlargement: false })
        .png()
        .toBuffer();
    } catch (e: any) {
      throw new ImageProcessingError(`Sharp failed to process SVG: ${e.message}`);
    }

    const resultBase64 = pngBuffer.toString("base64");
    const svgBase64 = Buffer.from(cleanedSvg).toString("base64");
    
    // Update cache
    imageCache.set(hash, { resultBase64, svgBase64, timestamp: Date.now() });

    // Trigger Webhook for success
    try {
      await fetch(`http://localhost:${PORT}/api/v1/webhook/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', resultBase64, svgBase64 })
      });
    } catch (err) {
      logger.error(`Failed to trigger webhook: ${err}`);
    }

    logger.info(`Successfully processed job ${jobId}`);
    return { resultBase64, svgBase64 };

  } catch (error: any) {
    const errorType = error.type || 'UnknownError';
    logger.error(`Error processing job ${jobId}: [${errorType}] ${error.message}`);
    
    // Trigger Webhook for failure
    try {
      await fetch(`http://localhost:${PORT}/api/v1/webhook/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'failed', error: error.message, errorType })
      });
    } catch (err) {
      logger.error(`Failed to trigger webhook: ${err}`);
    }
    
    // BullMQ failedReason
    throw new Error(JSON.stringify({ message: error.message, type: errorType }));
  }
};

app.post("/api/v1/process-logo", limiter, upload.single("logo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No logo file uploaded. Please upload a PNG, JPG, or WEBP file." });
    }

    // Validate dimensions
    try {
      const dimensions = sizeOf(req.file.buffer);
      if (!dimensions || !dimensions.width || !dimensions.height) {
        return res.status(400).json({ error: "Could not determine image dimensions." });
      }

      if (dimensions.width < 100 || dimensions.height < 100) {
        return res.status(400).json({ error: `Image too small (${dimensions.width}x${dimensions.height}). Minimum dimensions are 100x100 pixels.` });
      }

      if (dimensions.width > 2000 || dimensions.height > 2000) {
        return res.status(400).json({ error: `Image too large (${dimensions.width}x${dimensions.height}). Maximum dimensions are 2000x2000 pixels.` });
      }
    } catch (e) {
       return res.status(400).json({ error: "Invalid image file format." });
    }

    const hash = crypto.createHash("sha256").update(req.file.buffer).digest("hex");

    // Check Cache TTL
    const cached = imageCache.get(hash);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      return res.status(200).json({ status: "completed", resultBase64: cached.resultBase64, svgBase64: cached.svgBase64 });
    }

    const jobId = crypto.randomUUID();
    const imageBase64 = req.file.buffer.toString("base64");

    const options = {
      simplifyPaths: req.body.simplifyPaths === 'true',
      removeMetadata: req.body.removeMetadata === 'true',
      pathFitting: req.body.pathFitting === 'true',
      strokeOpt: req.body.strokeOpt === 'true',
      colorQuant: req.body.colorQuant === 'true',
      quality: req.body.quality || 'high',
      model: req.body.model || 'gemini-3.1-pro-preview'
    };

    // Add to BullMQ Queue
    await logoQueue.add('process', { imageBase64, mimetype: req.file.mimetype, hash, jobId, options }, { jobId });

    logger.info(`Job accepted and queued. Job ID: ${jobId}`);

    res.status(202).json({ 
      message: "Job accepted.",
      jobId 
    });

  } catch (error) {
    logger.error(`Error setting up job: ${error}`);
    let errorMessage = "An unexpected error occurred.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    res.status(500).json({ error: errorMessage });
  }
});

app.post("/api/v1/webhook/:jobId", express.json(), (req, res) => {
  const { jobId } = req.params;
  const { status, error, errorType } = req.body;
  logger.info(`[Webhook] Job ${jobId} updated: ${status}`);
  if (error) {
     logger.error(`[Webhook] Job ${jobId} Failed: [${errorType}] ${error}`);
  }
  res.status(200).json({ received: true });
});

app.get("/api/v1/status/:jobId", async (req, res) => {
  try {
    const job = await logoQueue.getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Job not found in queue." });
    }

    const state = await job.getState();

    if (state === "completed") {
      return res.json({ status: "completed", resultBase64: job.returnvalue?.resultBase64, svgBase64: job.returnvalue?.svgBase64 });
    } else if (state === "failed") {
      let errorObj = { message: job.failedReason, type: 'UnknownError' };
      try {
        if (job.failedReason) {
            errorObj = JSON.parse(job.failedReason);
        }
      } catch(e) { } // Keep parsing failsafe
      return res.json({ status: "failed", error: errorObj.message, errorType: errorObj.type });
    } else {
      // waiting, active, delayed
      return res.json({ status: "processing" });
    }
  } catch(e) {
    return res.status(500).json({ error: "Failed to retrieve job status." });
  }
});

app.post("/api/v1/optimize-svg", express.json({ limit: '50mb' }), async (req, res) => {
  try {
    const { svgBase64, options } = req.body;
    if (!svgBase64) {
      return res.status(400).json({ error: "Missing SVG base64 string." });
    }

    const rawSvg = Buffer.from(svgBase64, "base64").toString("utf-8");
    const cleanedSvg = cleanAndValidateSVG(rawSvg, options);
    
    let pngBuffer;
    try {
      pngBuffer = await sharp(Buffer.from(cleanedSvg))
        .trim()
        .resize(2000, 2000, { fit: "inside" })
        .png({ quality: 100 })
        .toBuffer();
    } catch (err) {
      throw new ImageProcessingError(`Sharp failed to process the SVG: ${err}`);
    }

    res.status(200).json({
      svgBase64: Buffer.from(cleanedSvg).toString("base64"),
      resultBase64: pngBuffer.toString("base64"),
    });

  } catch (error) {
    logger.error(`Error optimizing SVG: ${error}`);
    let errorMessage = "An unexpected error occurred.";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return res.status(500).json({ error: errorMessage });
  }
});

app.get("/api/v1/queue-stats", async (req, res) => {
  try {
    const counts = await logoQueue.getJobCounts('wait', 'active', 'completed', 'failed');
    res.json({
      pending: counts.wait,
      processing: counts.active,
      completed: counts.completed,
      failed: counts.failed,
      total: counts.wait + counts.active + counts.completed + counts.failed
    });
  } catch(e) {
    res.status(500).json({ error: "Could not fetch queue statistics." });
  }
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      logger.error(`Upload error: File size exceeds the 5MB limit.`);
      return res.status(413).json({ error: "File size exceeds the 5MB limit." });
    }
    logger.error(`Upload Error: ${err.message}`);
    return res.status(400).json({ error: `Upload Error: ${err.message}` });
  } else if (err) {
    logger.error(`Unknown Upload Error: ${err.message}`);
    return res.status(400).json({ error: err.message || "Unknown Upload Error" });
  }
  next();
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

