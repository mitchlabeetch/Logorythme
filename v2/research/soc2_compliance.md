# SOC2 Type II Compliance Requirements for Node.js Image Processing Microservice

## Executive Summary

This document provides a comprehensive compliance engineering analysis for a Node.js image processing microservice that accepts logo uploads (PNG/JPG/WEBP), processes them through AI, and returns vectorized white-on-transparent PNGs. It maps every service component to specific SOC2 Type II Trust Service Criteria, provides actionable implementation guidance with specific library versions, and includes audit-ready artifacts including log schemas, security checklists, and data handling policy templates.

---

## 1. SOC2 Type II Trust Service Criteria Mapping

### 1.1 Five Trust Service Criteria Overview

SOC2 Type II evaluates controls against five Trust Service Criteria (TSC) defined by the AICPA [^20^][^22^]:

| Criterion | Code | Status | Relevance to Image Processing Service |
|---|---|---|---|
| **Security** | CC1-CC9 | Mandatory | Access controls, encryption, monitoring, vulnerability management |
| **Availability** | A1.1-A1.3 | In Scope | Uptime SLAs, backup/recovery, capacity planning |
| **Processing Integrity** | PI1.1-PI1.5 | In Scope | Input validation, processing accuracy, output completeness |
| **Confidentiality** | C1.1-C1.2 | In Scope | PII/Logo data classification, encryption, secure disposal |
| **Privacy** | P1.1-P8.1 | In Scope | Data collection, use, retention, and disposal of personal information |

### 1.2 Common Criteria (CC1-CC9) Detailed Mapping

#### CC1: Control Environment

| Sub-Criterion | Requirement | Implementation |
|---|---|---|
| CC1.1 | Integrity and ethical values | Code of conduct acknowledged by all engineers; PR review requirements |
| CC1.2 | Board oversight | Security reviews in engineering standups |
| CC1.3 | Org structure | Documented security roles (security lead, on-call rotation) |
| CC1.4 | Competence | Security training records for all engineers |
| CC1.5 | Accountability | Signed policy acknowledgments annually [^23^] |

#### CC2: Communication and Information

| Sub-Criterion | Requirement | Implementation |
|---|---|---|
| CC2.1 | Information quality | Data classification policy (public, internal, confidential, restricted) |
| CC2.2 | Internal communication | Security bulletins via Slack/Teams; incident response channels |
| CC2.3 | External communication | Customer-facing security page; status page for availability incidents [^20^] |

#### CC3: Risk Assessment

| Sub-Criterion | Requirement | Implementation |
|---|---|---|
| CC3.1 | Risk identification | Annual risk register updates covering image processing threats |
| CC3.2 | Fraud risk | Evaluate risk of malicious uploads (polyglot files, SVG injection) |
| CC3.3 | Risk mitigation | Documented controls for each identified risk |
| CC3.4 | Change-related risk | Security review required for all infrastructure and code changes [^23^] |

#### CC4: Monitoring Activities

| Sub-Criterion | Requirement | Implementation |
|---|---|---|
| CC4.1 | Ongoing monitoring | SIEM integration; continuous security monitoring |
| CC4.2 | Separate evaluations | Quarterly access reviews; annual penetration testing [^74^] |

#### CC5: Control Activities

| Sub-Criterion | Requirement | Implementation |
|---|---|---|
| CC5.1 | Control selection | Technical controls mapped to each risk |
| CC5.2 | Control documentation | All controls documented with owners and review schedules |
| CC5.3 | Control enforcement | Automated enforcement via CI/CD gates [^20^] |

#### CC6: Logical and Physical Access Controls (Most Tested)

| Sub-Criterion | Requirement | Implementation for Image Service |
|---|---|---|
| CC6.1 | Logical access security | RBAC with least privilege; API key authentication; MFA for admin access |
| CC6.2 | User registration/auth | OAuth 2.0 / JWT with refresh token rotation; account lockout policies |
| CC6.3 | Role-based access | Quarterly access reviews; documented role definitions; segregation of duties |
| CC6.4 | Physical access restriction | Cloud provider physical security (AWS/GCP SOC2 reports); badge access for offices |
| CC6.5 | Credential protection | MFA enforcement (not advisory); password policy (12+ chars, last 12 passwords); secrets manager |
| CC6.6 | Third-party access | Vendor inventory; time-limited access; VPN for remote workers |
| CC6.7 | Data transmission protection | TLS 1.3 for all traffic; AES-256 for data at rest; HSTS headers |
| CC6.8 | Security software/patches | EDR on all endpoints; vulnerability scanning; patch SLA tracking [^66^][^74^] |

**Most common CC6 audit exceptions** [^66^]:
- CC6.1: Overly permissive firewall rules; no annual rule review
- CC6.2: Access provisioned before approval documented
- CC6.3: Access reviews performed annually instead of quarterly
- CC6.5: MFA not enforced (advisory mode); API keys in code repositories

#### CC7: System Operations (Monitoring)

| Sub-Criterion | Requirement | Implementation |
|---|---|---|
| CC7.1 | Detection infrastructure | All log sources ingested into SIEM; log retention >= 90 days |
| CC7.2 | Monitoring procedures | Anomaly detection on image upload volumes; automated alerting [^109^][^114^] |
| CC7.3 | Incident evaluation | Classification criteria; triage process; CVSS scoring [^37^] |
| CC7.4 | Incident response | Written IRP; tabletop exercises annually; post-incident reviews [^37^] |
| CC7.5 | Incident recovery | Restoration procedures; root cause analysis; procedure improvements [^114^] |

**Evidence auditors expect for CC7** [^74^]:
- Vulnerability scan report + remediation ticket(s) + patch/PR links
- Incident runbook + tabletop exercise agenda/attendees + incident postmortem template

#### CC8: Change Management

| Sub-Criterion | Requirement | Implementation |
|---|---|---|
| CC8.1 | Change control | All changes via PR; code review required; automated testing; deployment audit trail |

#### CC9: Risk Mitigation

| Sub-Criterion | Requirement | Implementation |
|---|---|---|
| CC9.1 | Vendor risk management | Vendor SOC2 reports reviewed annually; vendor security questionnaire |
| CC9.2 | Cyber insurance | Cyber liability insurance maintained; incident response retainer [^23^] |

### 1.3 Availability (A1)

| Sub-Criterion | Requirement | Implementation |
|---|---|---|
| A1.1 | Capacity management | Auto-scaling based on image processing queue depth; performance monitoring |
| A1.2 | Environmental protections | Multi-AZ deployment; redundant infrastructure |
| A1.3 | Backup and recovery | Daily automated backups; quarterly recovery testing; documented RTO/RPO [^20^][^22^] |

### 1.4 Processing Integrity (PI1)

| Sub-Criterion | Requirement | Implementation for Image Processing |
|---|---|---|
| PI1.1 | Processing objectives defined | Documented specifications: input formats (PNG/JPG/WEBP), output format (white-on-transparent PNG) |
| PI1.2 | Input validation | File type validation (magic numbers); size limits; format compliance checking |
| PI1.3 | Processing accuracy | Sharp library re-encoding with metadata stripping; output format enforcement |
| PI1.4 | Output completeness | Output verification; checksum validation; delivery confirmation |
| PI1.5 | Storage integrity | Checksums on stored images; integrity verification on retrieval [^20^][^22^] |

### 1.5 Confidentiality (C1)

| Sub-Criterion | Requirement | Implementation |
|---|---|---|
| C1.1 | Confidentiality commitments | Data classification policy; NDA for employees; customer-facing confidentiality terms |
| C1.2 | Information disposal | Secure deletion procedures; automated retention-based cleanup; disposal audit trail [^20^][^69^] |

### 1.6 Privacy (P1-P8)

| Sub-Criterion | Requirement | Implementation |
|---|---|---|
| P1.1 | Privacy notice | Published privacy policy with data collection purposes |
| P2.1 | Choice and consent | Consent mechanism for image uploads containing personal data |
| P3.1 | Collection limited | Only collect images necessary for processing; no unrelated data |
| P4.1 | Use limited | Images used solely for vectorization; no training data retention without consent |
| P4.2 | Retention period | Automated deletion after processing; configurable retention (default: 30 days) |
| P4.3 | Secure disposal | Cryptographic erasure of image files; disposal log [^69^][^70^] |
| P5.1-P5.2 | Access/correction | Data subject request handling procedures |
| P6.1-P6.7 | Third-party disclosures | DPA with AI processing provider; no unauthorized data sharing |
| P7.1 | Data quality | Input validation ensures processing accuracy |
| P8.1 | Monitoring and enforcement | Privacy complaint handling; annual privacy review [^20^][^70^] |

---

## 2. Security Headers for Express.js

### 2.1 Helmet Middleware Configuration

**Library**: `helmet` v8.0.0+

```javascript
const express = require('express');
const helmet = require('helmet');

const app = express();

// SOC2-Comprehensive Helmet Configuration
app.use(helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Remove unsafe-inline if possible
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },

  // HTTP Strict Transport Security (HSTS)
  strictTransportSecurity: {
    maxAge: 63072000, // 2 years in seconds
    includeSubDomains: true,
    preload: true,
  },

  // X-Frame-Options (Clickjacking prevention)
  xFrameOptions: { action: 'deny' },

  // X-Content-Type-Options (MIME sniffing prevention)
  xContentTypeOptions: true, // nosniff

  // Referrer Policy
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },

  // Hide X-Powered-By
  hidePoweredBy: true,

  // DNS Prefetch Control
  xDnsPrefetchControl: { allow: false },

  // X-Download-Options (IE)
  xDownloadOptions: true, // noopen

  // Cross-Domain Policy
  xPermittedCrossDomainPolicies: { permittedPolicies: 'none' },

  // Cross-Origin policies
  crossOriginEmbedderPolicy: false, // May need false for API compatibility
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // For image API
}));
```

**CSP for Image Upload Service** [^36^][^38^][^46^]:
- `default-src 'self'` - Only load from same origin
- `img-src 'self' data: blob:` - Allow data URIs for processed images
- `script-src 'self'` - Block inline scripts (critical for SVG XSS mitigation)
- `object-src 'none'` - Prevent Flash/Java applet injection

### 2.2 CORS Configuration

```javascript
const cors = require('cors'); // v2.8.5+

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    // Allow requests with no origin (mobile apps, curl)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  credentials: true,
  maxAge: 86400, // 24 hours preflight cache
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
```

### 2.3 Required Headers Checklist

| Header | Value | SOC2 Mapping | Purpose |
|---|---|---|---|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | CC6.7 | Force HTTPS connections |
| `Content-Security-Policy` | See above | CC6.7 | XSS mitigation, resource control |
| `X-Frame-Options` | `DENY` | CC6.7 | Clickjacking prevention |
| `X-Content-Type-Options` | `nosniff` | CC6.7 | MIME sniffing prevention |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | C1.1 | Data leakage prevention |
| `X-DNS-Prefetch-Control` | `off` | P1.1 | Privacy protection |
| `Cache-Control` | `no-store, no-cache` | C1.1 | Prevent sensitive data caching |
| `Permissions-Policy` | `camera=(), microphone=()` | P3.1 | Restrict browser APIs |

---

## 3. Input Validation and Sanitization

### 3.1 Image Upload Validation Pipeline

For a service accepting PNG/JPG/WEBP uploads, implement a **6-layer validation pipeline** [^72^][^108^][^113^]:

```javascript
const multer = require('multer');          // v1.4.5-lts.1
const sharp = require('sharp');            // v0.33.0+
const { fileTypeFromBuffer } = require('file-type'); // v19.0.0+
const crypto = require('crypto');
const path = require('path');

// Layer 1: Multer fileFilter - MIME type + extension validation
const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const fileFilter = (req, file, cb) => {
  // Check MIME type
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error('Invalid MIME type'), false);
  }
  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return cb(new Error('Invalid file extension'), false);
  }
  return cb(null, true);
};

const upload = multer({
  storage: multer.memoryStorage(), // Store in memory, not disk
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 10,
  },
  fileFilter,
});

// Layer 2: Buffer-based magic number validation (prevents polyglot attacks)
async function validateFileSignature(buffer) {
  const type = await fileTypeFromBuffer(buffer);
  if (!type || !allowedMimeTypes.includes(type.mime)) {
    throw new Error('File signature does not match allowed types');
  }
  return type;
}

// Layer 3: Sharp image validation + re-encoding (strips malicious metadata)
async function validateAndSanitizeImage(buffer) {
  try {
    const metadata = await sharp(buffer).metadata();
    
    // Validate dimensions
    const MAX_DIMENSION = 8192;
    if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
      throw new Error(`Image dimensions exceed maximum (${MAX_DIMENSION}px)`);
    }
    
    // Validate format
    const validFormats = ['jpeg', 'png', 'webp'];
    if (!validFormats.includes(metadata.format)) {
      throw new Error(`Unsupported image format: ${metadata.format}`);
    }

    // Re-encode to strip all metadata and embedded scripts
    const sanitizedBuffer = await sharp(buffer)
      .rotate() // Normalize orientation
      .withMetadata({  // Strip EXIF, XMP, ICC profiles
        exif: {},
        icc: undefined,
        xmp: undefined,
        iptcp: undefined,
      })
      .toFormat(metadata.format, { 
        quality: metadata.format === 'png' ? undefined : 90,
        progressive: true,
      })
      .toBuffer();

    return { sanitizedBuffer, metadata };
  } catch (err) {
    throw new Error(`Image validation failed: ${err.message}`);
  }
}

// Layer 4: Filename sanitization
function sanitizeFilename(filename) {
  return crypto.randomUUID() + path.extname(filename).toLowerCase();
}

// Layer 5: Rate limiting per upload endpoint
const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 uploads per IP
  message: { error: 'Upload rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Combined upload middleware
app.post('/api/v1/upload',
  uploadRateLimit,
  upload.single('image'),
  async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Layer 2: Magic number validation
      const fileType = await validateFileSignature(req.file.buffer);
      
      // Layer 3: Image sanitization
      const { sanitizedBuffer, metadata } = 
        await validateAndSanitizeImage(req.file.buffer);
      
      // Layer 4: Safe filename
      const safeFilename = sanitizeFilename(req.file.originalname);
      
      // Attach sanitized data for downstream processing
      req.sanitizedImage = {
        buffer: sanitizedBuffer,
        filename: safeFilename,
        originalType: fileType.mime,
        metadata,
      };
      
      next();
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  },
  processImageController
);
```

### 3.2 SVG Injection Prevention

Although this service accepts raster images only, SVG upload attempts must be explicitly blocked [^36^][^115^]:

```javascript
// SVG is explicitly NOT in allowedMimeTypes - this prevents SVG XSS
// If SVG support is added later, implement DOMPurify sanitization:

const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

function sanitizeSVG(svgContent) {
  return DOMPurify.sanitize(svgContent, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: [], // Don't add any custom tags
    ADD_ATTR: ['fill', 'stroke', 'viewBox'], // Only safe attributes
  });
}
```

### 3.3 File Upload Attack Vectors

| Attack Vector | Mitigation | SOC2 Mapping |
|---|---|---|
| **Polyglot files** | Sharp re-encoding strips embedded scripts | PI1.2 |
| **Malicious EXIF/XMP metadata** | `withMetadata({})` strips all metadata | C1.1 |
| **MIME type spoofing** | Magic number validation via `file-type` | PI1.2 |
| **Path traversal** | UUID-based filenames; no user input in paths | CC6.1 |
| **SVG XSS injection** | Block SVG uploads; CSP script-src restriction | CC6.7 |
| **PDF bomb/decompression** | File size limits; Sharp re-encoding | PI1.2 |
| **Steganography in images** | Sharp re-encoding removes steganographic data | C1.1 |

---

## 4. Audit Logging Requirements

### 4.1 SOC2 Audit Log Mandatory Fields

Every audit log entry MUST capture four fields [^16^]:

1. **User identity** - Who performed the action (user ID, API key ID, service account)
2. **Action name** - What action was performed (e.g., `image.upload`, `admin.config.update`)
3. **Timestamp** - When (ISO 8601 UTC with millisecond precision)
4. **Affected resource** - What resource was affected (image ID, user ID, config key)

### 4.2 Audit Log Schema

```json
{
  "eventId": "evt_550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-01-15T14:32:01.234Z",
  "eventType": "image.upload",
  "eventCategory": "user_activity",
  "severity": "info",
  "actor": {
    "type": "api_key",
    "id": "key_abc123",
    "ipAddress": "203.0.113.42",
    "userAgent": "Mozilla/5.0...",
    "sessionId": "sess_def456"
  },
  "action": {
    "name": "image.upload",
    "description": "User uploaded an image for vectorization",
    "status": "success",
    "durationMs": 1450
  },
  "resource": {
    "type": "image",
    "id": "img_ghi789",
    "metadata": {
      "originalFormat": "image/png",
      "originalFilename": "logo.png",
      "fileSizeBytes": 524288,
      "dimensions": { "width": 1024, "height": 1024 }
    }
  },
  "result": {
    "outputImageId": "img_out_jkl012",
    "outputFormat": "image/png",
    "processingTimeMs": 1200
  },
  "requestContext": {
    "requestId": "req_mno345",
    "traceId": "trace_pqr678",
    "route": "POST /api/v1/upload",
    "region": "us-east-1"
  },
  "compliance": {
    "retentionClass": "standard",
    "dataClassification": "confidential",
    "gdprRelevant": false
  }
}
```

### 4.3 Six Categories of Audit Events

| Category | Event Types | SOC2 Mapping |
|---|---|---|
| **Authentication events** | `auth.login`, `auth.logout`, `auth.failed`, `auth.mfaChallenge`, `auth.sessionEnd` | CC6.1, CC6.5 |
| **Role/permission changes** | `access.grant`, `access.revoke`, `role.create`, `role.update`, `role.delete` | CC6.3 |
| **Policy changes** | `policy.update`, `config.change`, `rateLimit.modify`, `retention.modify` | CC5.2 |
| **Access request decisions** | `access.request`, `access.approve`, `access.deny`, `access.justify` | CC6.2 |
| **Data exposure events** | `image.upload`, `image.download`, `image.delete`, `image.process`, `data.export` | CC6.7, C1.1 |
| **Change execution** | `deploy.start`, `deploy.rollback`, `admin.execute`, `emergency.bypass` | CC8.1 |

### 4.4 Log Retention and Immutability

| Requirement | Specification | Implementation |
|---|---|---|
| **Minimum retention** | 12 months (common baseline) [^16^] | S3 with object lock / WORM storage |
| **Immutability** | Tamper-evident storage | Cryptographic chaining (each entry includes hash of previous); or append-only S3 buckets with Object Lock in Compliance Mode |
| **SIEM export** | Structured, queryable format | JSON Lines format; exportable to Splunk/Datadog/ELK |
| **Break-glass logging** | Same fidelity as normal paths | Emergency access attempts logged with same 4-field schema |

### 4.5 Log Implementation (Winston + Structured Logging)

```javascript
const winston = require('winston');       // v3.11.0
const { v4: uuidv4 } = require('uuid');   // v9.0.0

// Custom format with ISO timestamps
const auditFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Separate logger for audit events (immutable, compliance-grade)
const auditLogger = winston.createLogger({
  level: 'info',
  format: auditFormat,
  defaultMeta: { service: 'image-processor', environment: process.env.NODE_ENV },
  transports: [
    // Console for real-time monitoring
    new winston.transports.Console(),
    // File for local retention
    new winston.transports.File({
      filename: '/var/log/audit/audit.log',
      maxsize: 104857600, // 100MB
      maxFiles: 30,
    }),
    // HTTP transport to SIEM/centralized log store
    new winston.transports.Http({
      host: process.env.SIEM_HOST,
      port: process.env.SIEM_PORT || 443,
      ssl: true,
      path: '/v1/logs',
      auth: { bearer: process.env.SIEM_API_KEY },
    }),
  ],
});

// Audit event helper function
function logAuditEvent({ eventType, actor, action, resource, result, requestContext, compliance }) {
  auditLogger.info({
    eventId: `evt_${uuidv4()}`,
    timestamp: new Date().toISOString(),
    eventType,
    eventCategory: getEventCategory(eventType),
    severity: getEventSeverity(eventType, action.status),
    actor,
    action,
    resource,
    result,
    requestContext,
    compliance,
  });
}

module.exports = { auditLogger, logAuditEvent };
```

---

## 5. PII Handling in Image Processing

### 5.1 Data Classification for Image Content

| Classification | Description | Examples | Handling |
|---|---|---|---|
| **Public** | No personal information; corporate logos | Company logos, brand marks | Standard processing |
| **Internal** | Contains business information | Product screenshots with UI | Standard processing + limited retention |
| **Confidential** | May contain personal information | Photos of people, ID cards | Strict retention + metadata stripping |
| **Restricted** | Explicit personal data | Government IDs, medical images | Enhanced encryption + minimum retention |

### 5.2 PII Detection and Handling

```javascript
// Automated PII detection in image metadata
async function detectPIIInMetadata(imageBuffer) {
  const metadata = await sharp(imageBuffer).metadata();
  const piiIndicators = [];
  
  // Check EXIF for GPS coordinates
  if (metadata.exif) {
    const exif = await sharp(imageBuffer).exif();
    if (exif.gps) {
      piiIndicators.push('GPS_LOCATION');
    }
  }
  
  // Check for embedded thumbnails (may contain faces)
  if (metadata.hasProfile) {
    piiIndicators.push('ICC_PROFILE');
  }
  
  // Check for XMP metadata
  if (metadata.xmp) {
    piiIndicators.push('XMP_METADATA');
  }
  
  return {
    containsPII: piiIndicators.length > 0,
    indicators: piiIndicators,
    recommendation: piiIndicators.length > 0 
      ? 'ENHANCED_RETENTION' 
      : 'STANDARD_PROCESSING',
  };
}

// Apply classification-based handling
async function handleClassifiedImage(imageBuffer, userClassification) {
  const piiCheck = await detectPIIInMetadata(imageBuffer);
  
  const effectiveClassification = 
    userClassification === 'public' && piiCheck.containsPII
      ? 'confidential' // Upgrade classification if PII detected
      : userClassification;
  
  return {
    classification: effectiveClassification,
    piiCheck,
    retentionDays: getRetentionForClassification(effectiveClassification),
    encryptionRequired: effectiveClassification === 'restricted',
  };
}

function getRetentionForClassification(classification) {
  const retentionMap = {
    public: 30,
    internal: 14,
    confidential: 7,
    restricted: 1, // Process and delete immediately
  };
  return retentionMap[classification] || 7;
}
```

### 5.3 Data Handling Policy Template

```markdown
# Data Handling Policy - Image Processing Service

## 1. Purpose
This policy defines how the image processing service handles uploaded 
images, including personal data that may be contained within them.

## 2. Scope
Applies to all image uploads processed by the vectorization microservice.

## 3. Data Classification
- **Public**: Corporate logos, brand marks (no personal data)
- **Internal**: Business-related images
- **Confidential**: May contain personal information
- **Restricted**: Explicit personal/sensitive data

## 4. Collection Principles (P3.1)
- Only collect images necessary for vectorization processing
- Images containing personal data require explicit consent
- No collection of government IDs or medical images without DPA

## 5. Use Limitations (P4.1)
- Images used solely for vectorization processing
- No use for AI/ML training without explicit opt-in consent
- No sharing with third parties except processing subcontractors under DPA

## 6. Retention (P4.2)
| Classification | Retention Period | Auto-Deletion |
|---|---|---|
| Public | 30 days | Yes |
| Internal | 14 days | Yes |
| Confidential | 7 days | Yes |
| Restricted | 24 hours | Yes |

## 7. Secure Disposal (P4.3)
- Cryptographic erasure using secure deletion (overwrite 3x)
- Disposal logged with image ID, timestamp, and actor
- Backup images purged according to retention schedule

## 8. Data Subject Rights (P5.1-P5.2)
- Access requests fulfilled within 30 days
- Deletion requests processed within 72 hours
- Portability provided as original upload format

## 9. Metadata Stripping
All EXIF, XMP, ICC, and GPS metadata is removed during processing 
via Sharp library re-encoding.

## 10. Incident Reporting
Unauthorized disclosure of personal data triggers breach notification 
within 72 hours per GDPR requirements.
```

### 5.4 Automatic Data Retention and Cleanup

```javascript
// Cron job for automatic data cleanup
const cron = require('node-cron');        // v3.0.3
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');

// Run daily at 2 AM UTC
cron.schedule('0 2 * * *', async () => {
  console.log('Running data retention cleanup...');
  
  const expiredImages = await db.images.findExpired({
    retentionExpiredBefore: new Date(),
  });
  
  for (const image of expiredImages) {
    try {
      // Delete from storage
      await s3.send(new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: image.storageKey,
      }));
      
      // Log disposal
      logAuditEvent({
        eventType: 'data.disposal',
        actor: { type: 'system', id: 'retention-cleanup' },
        action: { name: 'data.disposal', status: 'success' },
        resource: { type: 'image', id: image.id },
        compliance: { retentionClass: image.classification },
      });
      
      // Mark as deleted in database
      await db.images.markDeleted(image.id);
    } catch (err) {
      console.error(`Failed to delete image ${image.id}:`, err);
    }
  }
});
```

---

## 6. Data Encryption

### 6.1 Encryption at Rest

| Layer | Standard | Implementation |
|---|---|---|
| **Database** | AES-256 | PostgreSQL with TDE; or document DB with server-side encryption |
| **Object Storage (S3)** | AES-256 SSE-KMS | S3 Server-Side Encryption with AWS KMS customer-managed keys |
| **File System (EBS)** | AES-256 | Encrypted EBS volumes for all instances |
| **Backups** | AES-256 | Encrypted snapshots; keys stored separately from backups |
| **Application-level** | AES-256-GCM | For highly sensitive fields (API tokens) using `libsodium` or `crypto` |

```javascript
const { KMSClient, EncryptCommand, DecryptCommand } = require('@aws-sdk/client-kms');

const kms = new KMSClient({ region: process.env.AWS_REGION });

// Encrypt sensitive field before storage
async function encryptField(plaintext, keyId) {
  const result = await kms.send(new EncryptCommand({
    KeyId: keyId,
    Plaintext: Buffer.from(plaintext, 'utf-8'),
    EncryptionAlgorithm: 'SYMMETRIC_DEFAULT',
  }));
  return result.CiphertextBlob.toString('base64');
}

// Decrypt on retrieval
async function decryptField(ciphertext, keyId) {
  const result = await kms.send(new DecryptCommand({
    CiphertextBlob: Buffer.from(ciphertext, 'base64'),
    KeyId: keyId,
    EncryptionAlgorithm: 'SYMMETRIC_DEFAULT',
  }));
  return result.Plaintext.toString('utf-8');
}
```

### 6.2 Encryption in Transit

| Channel | Requirement | Implementation |
|---|---|---|
| **External API** | TLS 1.3 | Configure load balancer with TLS 1.3 + strong cipher suites |
| **Internal service-to-service** | mTLS | Service mesh (Istio/Linkerd) or mutual TLS certificates |
| **Database connections** | TLS required | `sslmode=require` (PostgreSQL); reject unencrypted connections |
| **Message queues** | TLS | AMQP over TLS; encrypted Redis connections |

```javascript
// Express.js TLS 1.3 enforcement
const https = require('https');
const fs = require('fs');

const tlsOptions = {
  key: fs.readFileSync('/path/to/private.key'),
  cert: fs.readFileSync('/path/to/certificate.crt'),
  // Enforce TLS 1.2 minimum, prefer 1.3
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3',
  // Strong cipher suites only
  cipherSuites: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    'TLS_AES_128_GCM_SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-CHACHA20-POLY1305',
  ].join(':'),
  honorCipherOrder: true,
  // Perfect forward secrecy
  ecdhCurve: 'auto',
};

https.createServer(tlsOptions, app).listen(443);
```

### 6.3 Key Management

| Practice | Requirement |
|---|---|
| Key generation | FIPS-approved algorithms; HSM or cloud KMS |
| Key storage | Encrypted at rest; access requires MFA |
| Key rotation | Data encryption keys: 90 days; Key-encryption keys: 1 year; TLS certificates: 2 years |
| Key revocation | Immediate on compromise suspicion; automated revocation procedures |
| Audit logging | All key operations logged (generation, rotation, destruction, access) [^17^][^18^] |

---

## 7. Access Controls

### 7.1 Authentication Architecture

```javascript
const jwt = require('jsonwebtoken');      // v9.0.0
const bcrypt = require('bcryptjs');       // v2.4.3
const { expressjwt: expressJwt } = require('express-jwt'); // v8.4.1
const jwksRsa = require('jwks-rsa');      // v3.1.0

// JWT Configuration
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const JWT_SECRET = process.env.JWT_SECRET; // Separate secret for access tokens
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET; // Separate secret for refresh tokens

// Token generation with rotation
function generateTokenPair(userId, role, permissions) {
  const accessToken = jwt.sign(
    { 
      sub: userId, 
      type: 'access',
      role,
      permissions,
      iat: Math.floor(Date.now() / 1000),
    },
    JWT_SECRET,
    { 
      expiresIn: ACCESS_TOKEN_EXPIRY,
      algorithm: 'HS256',
      jwtid: crypto.randomUUID(),
    }
  );

  const refreshToken = jwt.sign(
    {
      sub: userId,
      type: 'refresh',
      tokenId: crypto.randomUUID(),
      familyId: crypto.randomUUID(),
      iat: Math.floor(Date.now() / 1000),
    },
    REFRESH_SECRET,
    {
      expiresIn: REFRESH_TOKEN_EXPIRY,
      algorithm: 'HS256',
    }
  );

  return { accessToken, refreshToken };
}

// JWT validation middleware
const jwtMiddleware = expressJwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: process.env.JWKS_URI,
  }),
  algorithms: ['RS256', 'HS256'],
  issuer: process.env.TOKEN_ISSUER,
  audience: process.env.TOKEN_AUDIENCE,
  // Custom claims verification
  getToken: (req) => {
    if (req.headers.authorization?.startsWith('Bearer ')) {
      return req.headers.authorization.slice(7);
    }
    return undefined;
  },
});

// Refresh token rotation endpoint
app.post('/api/v1/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  
  try {
    const payload = jwt.verify(refreshToken, REFRESH_SECRET, { clockTolerance: 60 });
    
    // Check if token is revoked (stored in Redis)
    const isRevoked = await redis.get(`revoked:${payload.jti}`);
    if (isRevoked) {
      // Token reuse detected - revoke entire family
      await redis.set(`revoked_family:${payload.familyId}`, 'true', 'EX', 604800);
      return res.status(401).json({ error: 'Token reuse detected. Session revoked.' });
    }
    
    // Revoke old token
    await redis.set(`revoked:${payload.jti}`, 'true', 'EX', 604800);
    
    // Generate new pair
    const tokenPair = generateTokenPair(payload.sub);
    
    res.json(tokenPair);
  } catch (err) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});
```

### 7.2 Role-Based Access Control (RBAC)

```javascript
// Role definitions with permissions matrix
const ROLES = {
  admin: {
    permissions: [
      'image:read:any', 'image:write:any', 'image:delete:any',
      'config:read', 'config:write',
      'audit:read', 'user:manage',
    ],
    description: 'Full system access',
  },
  operator: {
    permissions: [
      'image:read:any', 'image:write:any',
      'audit:read',
    ],
    description: 'Operations team access',
  },
  user: {
    permissions: [
      'image:read:own', 'image:write:own', 'image:delete:own',
    ],
    description: 'Standard user access',
  },
  api_client: {
    permissions: [
      'image:write:own', 'image:read:own',
    ],
    description: 'API-only access',
  },
};

// RBAC middleware
function requirePermission(permission) {
  return (req, res, next) => {
    const userRole = req.auth?.role;
    const userPermissions = ROLES[userRole]?.permissions || [];
    
    // Check for specific permission or wildcard
    const hasPermission = userPermissions.some(p => 
      p === permission || 
      p === permission.replace(/:(own|any)$/, ':*') ||
      p.endsWith(':*')
    );
    
    if (!hasPermission) {
      logAuditEvent({
        eventType: 'access.denied',
        actor: { type: 'user', id: req.auth.sub },
        action: { name: 'access.denied', status: 'denied' },
        resource: { type: 'permission', id: permission },
      });
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

// Resource ownership check
function requireOwnership(getResourceOwner) {
  return async (req, res, next) => {
    const resourceOwner = await getResourceOwner(req);
    const isAdmin = req.auth.role === 'admin';
    const isOwner = req.auth.sub === resourceOwner;
    
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Access denied to this resource' });
    }
    
    next();
  };
}

// Usage example
app.get('/api/v1/images/:id', 
  jwtMiddleware,
  requirePermission('image:read:own'),
  requireOwnership(req => db.images.getOwner(req.params.id)),
  getImageController
);
```

### 7.3 Multi-Factor Authentication (MFA)

SOC2 CC6.3 mandates MFA enforcement (not advisory mode) for [^66^][^71^]:
- Production system access
- Code repository access (GitHub/GitLab)
- Cloud console access (AWS/GCP)
- Identity provider admin access (Okta/Azure AD)

```javascript
// MFA check middleware
function requireMFA(req, res, next) {
  const amr = req.auth?.amr || []; // Authentication Methods Reference
  
  if (!amr.includes('mfa')) {
    logAuditEvent({
      eventType: 'auth.mfaRequired',
      actor: { type: 'user', id: req.auth.sub },
      action: { name: 'auth.mfaRequired', status: 'blocked' },
    });
    return res.status(403).json({ 
      error: 'MFA required',
      mfaRequired: true,
    });
  }
  
  next();
}

// Apply to admin endpoints
app.patch('/api/v1/admin/config', 
  jwtMiddleware, 
  requireMFA, 
  requirePermission('config:write'),
  updateConfigController
);
```

### 7.4 Session Management

| Control | Implementation | SOC2 Mapping |
|---|---|---|
| **Session timeout** | 15-minute access token expiry; force re-auth after 30 days | CC6.5 |
| **Concurrent session limit** | Max 5 concurrent sessions per user | CC6.1 |
| **Session invalidation** | Server-side revocation list (Redis) | CC6.2 |
| **Device fingerprinting** | Bind tokens to IP + User-Agent hash | CC6.5 |
| **Secure cookie storage** | `HttpOnly; Secure; SameSite=Strict` | CC6.7 |

### 7.5 Quarterly Access Reviews

```javascript
// Access review record structure
const accessReviewRecord = {
  reviewId: 'review_2025_q1',
  period: { start: '2025-01-01', end: '2025-03-31' },
  system: 'image-processing-service',
  reviewer: { id: 'user_admin_001', name: 'Security Lead' },
  reviewedAt: '2025-04-05T10:00:00Z',
  findings: [
    {
      userId: 'user_123',
      role: 'operator',
      finding: 'appropriate',
      justification: 'Active operations team member',
    },
    // ...
  ],
  signOff: {
    reviewerSignature: '...',
    approvedAt: '2025-04-05T12:00:00Z',
  },
};
```

---

## 8. Rate Limiting and DDoS Protection

### 8.1 Multi-Layer Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');  // v7.1.0+
const RedisStore = require('rate-limit-redis');    // v4.2.0

// Layer 1: General API rate limit
const generalLimiter = rateLimit({
  store: new RedisStore({ sendCommand: (...args) => redis.call(...args) }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  standardHeaders: true,  // RateLimit-* headers
  legacyHeaders: false,   // Disable X-RateLimit-* headers
  keyGenerator: (req) => req.ip,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(req.rateLimit.resetTime / 1000),
    });
  },
});

// Layer 2: Upload-specific rate limit (stricter)
const uploadLimiter = rateLimit({
  store: new RedisStore({ sendCommand: (...args) => redis.call(...args) }),
  windowMs: 15 * 60 * 1000,
  max: 20, // 20 uploads per 15 minutes
  standardHeaders: true,
  keyGenerator: (req) => req.ip,
});

// Layer 3: Auth endpoint rate limit (strictest - brute force protection)
const authLimiter = rateLimit({
  store: new RedisStore({ sendCommand: (...args) => redis.call(...args) }),
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per 15 minutes
  standardHeaders: true,
  skipSuccessfulRequests: true, // Don't count successful logins
  keyGenerator: (req) => req.body.email || req.ip,
});

// Layer 4: Heavy operation rate limit (AI processing)
const processingLimiter = rateLimit({
  store: new RedisStore({ sendCommand: (...args) => redis.call(...args) }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 processing requests per hour
  standardHeaders: true,
});

// Apply limits
app.use('/api/', generalLimiter);
app.use('/api/v1/upload', uploadLimiter);
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/process', processingLimiter);
```

### 8.2 DDoS Protection Architecture

| Layer | Control | Implementation |
|---|---|---|
| **Network** | WAF/CDN | CloudFlare / AWS CloudFront / Fastly |
| **Application** | Rate limiting | express-rate-limit with Redis (distributed) |
| **Infrastructure** | Auto-scaling | Kubernetes HPA; CPU/memory-based scaling |
| **Monitoring** | Traffic analysis | Anomaly detection on request volumes |
| **Response** | IP blocking | Automated IP reputation blocking [^34^][^47^] |

### 8.3 Rate Limit Response Headers

```
RateLimit-Policy: 100;w=900;comment="general"
RateLimit-Limit: 100
RateLimit-Remaining: 87
RateLimit-Reset: 847
```

---

## 9. Vulnerability Scanning and Dependency Management

### 9.1 CI/CD Security Pipeline

```yaml
# .github/workflows/security-scan.yml
name: Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight

jobs:
  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run npm audit
        run: npm audit --audit-level=high --json > npm-audit-results.json
        continue-on-error: true
      
      - name: Run Snyk scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high --json-file-output=snyk-results.json
        continue-on-error: true
      
      - name: Run SonarCloud scan
        uses: SonarSource/sonarcloud-github-action@master
        env:
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
      
      - name: Upload scan results
        uses: actions/upload-artifact@v4
        with:
          name: security-scan-results
          path: |
            npm-audit-results.json
            snyk-results.json
  
  static-analysis:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run ESLint with security plugin
        run: npx eslint . --ext .js,.ts
      
      - name: Run security-focused linting
        run: |
          npx eslint . \
            --plugin security \
            --rule 'security/detect-object-injection: error' \
            --rule 'security/detect-non-literal-fs-filename: error' \
            --rule 'security/detect-eval-with-expression: error'
      
      - name: Run npm outdated
        run: npm outdated || true
```

### 9.2 Dependabot Configuration

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "daily"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
      - "security"
    groups:
      production-dependencies:
        patterns:
          - "*"
        exclude-patterns:
          - "@types/*"
          - "eslint*"
    # Auto-merge patch updates for security
    commit-message:
      prefix: "security"
      include: "scope"
    
  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
    labels:
      - "dependencies"
      - "docker"
```

### 9.3 Security Scanning Tools Comparison

| Tool | Type | Strengths | SOC2 Evidence |
|---|---|---|---|
| **npm audit** | Dependency scanning | Built-in; no extra setup | CI pipeline logs |
| **Snyk** | Dependency + container | Human-curated DB; auto-fix PRs | Snyk dashboard export |
| **SonarQube/Cloud** | Static analysis | Code quality + security hotspots | Sonar reports |
| **ESLint security** | Static analysis | Detects anti-patterns in code | Lint report |
| **Trivy** | Container scanning | Scans Docker images for CVEs | Container scan reports |
| **OWASP ZAP** | DAST | Dynamic application scanning | ZAP scan reports |

### 9.4 Dependency Management Policy

```markdown
# Dependency Management Policy

## 1. Approved Dependencies
- All production dependencies must be reviewed before inclusion
- Prefer packages with >10k weekly downloads
- Check maintenance status (last update <6 months)

## 2. Vulnerability Response SLAs
| Severity | Remediation SLA | Evidence |
|---|---|---|
| Critical | 24 hours | P0 ticket + PR link |
| High | 7 days | P1 ticket + PR link |
| Medium | 30 days | P2 ticket |
| Low | 90 days | Backlog item |

## 3. Update Schedule
- Security patches: immediate
- Minor versions: monthly
- Major versions: quarterly with testing

## 4. Prohibited Patterns
- No packages with known unfixed critical CVEs
- No packages deprecated by maintainer
- No packages with incompatible licenses (GPL-3.0, AGPL-3.0)
```

---

## 10. Incident Response Patterns

### 10.1 Incident Response Plan Structure

A SOC2-ready incident response program requires six components [^37^]:

1. **Written incident response plan** - Approved by leadership; reviewed annually
2. **Runbooks for common scenarios** - Credential compromise, data exfiltration, DDoS, insider threat
3. **Defined detection and escalation paths** - Alert -> Triage -> Escalation workflow
4. **Documented incidents** - Every incident during observation period must have a record
5. **Tabletop exercises** - At least annually; mature programs quarterly
6. **Post-incident reviews** - Root cause analysis; procedure improvements

### 10.2 Incident Severity Classification

| Severity | Criteria | Response Time | Notification |
|---|---|---|---|
| **P1 - Critical** | Data breach; service outage; active attack | 15 minutes | CEO, Legal, Security Lead |
| **P2 - High** | Potential data exposure; significant degradation | 1 hour | Security Lead, Engineering Lead |
| **P3 - Medium** | Single system issue; non-critical vulnerability | 4 hours | On-call engineer |
| **P4 - Low** | Minor issue; informational alert | 24 hours | Weekly digest [^37^][^49^] |

### 10.3 Incident Response Runbook: Data Breach

```markdown
# Data Breach Response Runbook

## Detection
- Alert triggered by: DLP tool, SIEM anomaly, user report, automated scan
- Validate: Confirm breach scope; identify affected systems

## Containment (First 30 minutes)
1. Isolate affected systems
2. Revoke compromised credentials
3. Enable enhanced logging
4. Preserve evidence (snapshot affected systems)

## Assessment (30 minutes - 4 hours)
1. Identify affected data types and volume
2. Determine root cause
3. Assess if notification is required (GDPR, state laws, contracts)
4. Engage legal counsel

## Notification (within required timelines)
- Regulatory: 72 hours (GDPR), without unreasonable delay (state laws)
- Customers: As required by contract
- Internal: Security Lead -> CEO -> Board (if material)

## Remediation
1. Patch vulnerability / fix misconfiguration
2. Restore from clean backups if needed
3. Verify containment effectiveness
4. Enhanced monitoring for 30 days

## Post-Incident Review (within 1 week)
1. Timeline reconstruction
2. Root cause analysis (5 Whys)
3. Action items with owners and deadlines
4. Update runbooks and controls
5. Lessons learned communication
```

### 10.4 Incident Documentation Template

```json
{
  "incidentId": "INC-2025-001",
  "title": "Unauthorized access to processed image storage",
  "severity": "P2",
  "status": "resolved",
  "detection": {
    "detectedAt": "2025-01-15T08:23:00Z",
    "source": "SIEM alert - unusual S3 access pattern",
    "detectedBy": "automated_monitoring"
  },
  "timeline": [
    { "time": "2025-01-15T08:23:00Z", "event": "SIEM alert triggered" },
    { "time": "2025-01-15T08:25:00Z", "event": "On-call engineer acknowledged" },
    { "time": "2025-01-15T08:30:00Z", "event": "Investigation started" },
    { "time": "2025-01-15T08:45:00Z", "event": "Root cause identified - misconfigured IAM policy" },
    { "time": "2025-01-15T08:50:00Z", "event": "IAM policy corrected" },
    { "time": "2025-01-15T09:00:00Z", "event": "Verification complete" }
  ],
  "affected": {
    "systems": ["S3 bucket: processed-images-prod"],
    "dataVolume": "~500 images",
    "users": ["customer_123", "customer_456"]
  },
  "rootCause": "IAM policy allowed s3:GetObject from overly broad principal",
  "remediation": [
    "IAM policy tightened to specific service role",
    "S3 bucket policy review conducted",
    "Added CloudTrail logging for all S3 access"
  ],
  "communications": [
    { "time": "2025-01-15T09:15:00Z", "audience": "internal", "method": "slack" },
    { "time": "2025-01-15T10:00:00Z", "audience": "affected_customers", "method": "email" }
  ],
  "lessonsLearned": [
    "IAM policy changes need security review",
    "S3 access anomalies should trigger faster alerts"
  ],
  "postMortemDate": "2025-01-22T14:00:00Z",
  "closedAt": "2025-01-22T16:00:00Z"
}
```

### 10.5 SOC2 Incident Response Controls Mapping

| Control | Requirement | Evidence |
|---|---|---|
| CC7.3 | Evaluate security events | Incident classification criteria; triage logs |
| CC7.4 | Handle confirmed incidents | IRP; runbooks; incident records |
| CC7.5 | Recovery from incidents | Restoration procedures; root cause analysis |
| CC4.2 | Evaluate IR program | Tabletop exercise records; post-mortem reviews [^37^][^39^][^49^] |

---

## 11. Security Configuration Checklist

### 11.1 Pre-Deployment Checklist

```
[ ] Helmet middleware configured with all security headers
[ ] CORS restricted to allowed origins only
[ ] TLS 1.3 configured with strong cipher suites
[ ] HSTS header with 2-year max-age and preload
[ ] CSP policy configured (no unsafe-inline scripts)
[ ] X-Frame-Options: DENY
[ ] Rate limiting on all endpoints (tiered)
[ ] File upload validation: MIME type + extension + magic numbers
[ ] Sharp re-encoding for all uploaded images (metadata stripping)
[ ] UUID-based filenames (no user input in paths)
[ ] JWT with 15-minute access token expiry
[ ] Refresh token rotation with reuse detection
[ ] MFA enforced for admin endpoints
[ ] RBAC with quarterly access reviews
[ ] Audit logging: user + action + timestamp + resource on every event
[ ] Log retention: 12+ months with tamper-evident storage
[ ] Data at rest encrypted (AES-256)
[ ] Data in transit encrypted (TLS 1.3)
[ ] Secrets in AWS Secrets Manager / HashiCorp Vault (not env files)
[ ] Automated data retention cleanup
[ ] npm audit in CI/CD pipeline
[ ] Snyk scanning in CI/CD pipeline
[ ] Dependabot configured for auto-updates
[ ] Incident response plan documented and approved
[ ] Tabletop exercise conducted within last 12 months
[ ] Security headers tested (securityheaders.com scan)
[ ] Penetration test completed within last 12 months
```

### 11.2 Required Environment Variables

```bash
# Required
NODE_ENV=production
PORT=443
JWT_SECRET=<256-bit-random>
REFRESH_TOKEN_SECRET=<256-bit-random-different-from-jwt-secret>
ALLOWED_ORIGINS=https://app.example.com,https://admin.example.com
AWS_REGION=us-east-1
S3_BUCKET=<encrypted-bucket-name>
KMS_KEY_ID=<kms-key-arn>
SIEM_HOST=logs.example.com
SIEM_API_KEY=<siem-api-key>
REDIS_URL=rediss://<host>:6379

# Secrets Manager
AWS_SECRETS_MANAGER_ARN=<secrets-manager-arn>

# TLS
TLS_CERT_PATH=/etc/ssl/certs/server.crt
TLS_KEY_PATH=/etc/ssl/private/server.key

# Retention
DEFAULT_RETENTION_DAYS=30
```

### 11.3 Docker Security Configuration

```dockerfile
# Dockerfile - Security Hardened
FROM node:20-alpine

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy dependency files first (better layer caching)
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY --chown=nodejs:nodejs . .

# Remove unnecessary tools
RUN apk del curl wget 2>/dev/null || true

# Run as non-root
USER nodejs

# Expose only necessary port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

CMD ["node", "server.js"]
```

---

## 12. Recommended Library Versions and Dependencies

### 12.1 Production Dependencies

| Package | Version | Purpose | SOC2 Mapping |
|---|---|---|---|
| `express` | ^4.18.2 | Web framework | CC6.7 |
| `helmet` | ^8.0.0 | Security headers | CC6.7 |
| `cors` | ^2.8.5 | CORS handling | CC6.7 |
| `express-rate-limit` | ^7.1.0 | Rate limiting | CC7.2 |
| `rate-limit-redis` | ^4.2.0 | Distributed rate limiting | CC7.2 |
| `multer` | ^1.4.5-lts.1 | File upload handling | PI1.2 |
| `sharp` | ^0.33.0 | Image processing + sanitization | PI1.2, C1.1 |
| `file-type` | ^19.0.0 | Magic number validation | PI1.2 |
| `jsonwebtoken` | ^9.0.0 | JWT authentication | CC6.5 |
| `express-jwt` | ^8.4.1 | JWT middleware | CC6.5 |
| `jwks-rsa` | ^3.1.0 | JWKS key rotation | CC6.5 |
| `bcryptjs` | ^2.4.3 | Password hashing | CC6.5 |
| `winston` | ^3.11.0 | Structured logging | CC7.2 |
| `@aws-sdk/client-s3` | ^3.450.0 | Encrypted object storage | CC6.7, C1.1 |
| `@aws-sdk/client-kms` | ^3.450.0 | Key management | CC6.7 |
| `ioredis` | ^5.3.0 | Session/token storage | CC6.5 |
| `uuid` | ^9.0.0 | UUID generation | CC6.1 |
| `dotenv` | ^16.3.0 | Environment config (dev only) | CC5.1 |

### 12.2 Development Dependencies

| Package | Version | Purpose | SOC2 Mapping |
|---|---|---|---|
| `eslint` | ^8.54.0 | Code quality | CC8.1 |
| `eslint-plugin-security` | ^2.1.0 | Security linting | PI1.2 |
| `jest` | ^29.7.0 | Testing framework | PI1.3 |
| `snyk` | ^1.1240.0 | Vulnerability scanning | CC7.2 |
| `@types/*` | latest | Type definitions | CC8.1 |

---

## 13. Evidence Collection for Audit

### 13.1 Audit Evidence Checklist

| SOC2 Control | Evidence Required | Collection Method |
|---|---|---|
| CC1.1-1.5 | Signed policy acknowledgments | HRIS export |
| CC2.1 | Data classification policy | Document repository |
| CC5.2 | Control documentation | Confluence/Notion export |
| CC6.1 | IAM exports, firewall rules | AWS IAM export, Security Group config |
| CC6.2 | User provisioning logs | IdP audit logs (Okta/Azure AD) |
| CC6.3 | Access review records | Quarterly review exports with sign-off |
| CC6.5 | MFA policy screenshots | IdP admin console screenshots |
| CC6.7 | TLS configuration evidence | SSL Labs scan results (A+ rating) |
| CC7.1 | SIEM configuration | SIEM dashboard screenshot |
| CC7.2 | Monitoring alert records | Alert history export |
| CC7.3 | Incident classification logs | Incident tracking system export |
| CC7.4 | IRP document + tabletop exercise | Signed IRP + tabletop agenda/attendees |
| CC8.1 | Change management records | PR history + deployment logs |
| CC9.1 | Vendor SOC2 reports | Vendor security folder |
| PI1.2 | Input validation tests | Test report + code review |
| C1.1 | Data classification inventory | Asset inventory export |
| C1.2 | Encryption configuration | S3 encryption screenshot, KMS key policy |
| P4.2 | Retention policy + evidence | Policy document + cleanup logs |
| P4.3 | Secure disposal logs | Deletion audit logs [^16^][^66^][^74^] |

### 13.2 SSL Labs A+ Rating Requirements

To achieve SSL Labs A+ rating (expected by auditors) [^18^]:
- TLS 1.2 or 1.3 only (disable 1.0/1.1)
- Strong cipher suites: AES-GCM or ChaCha20-Poly1305
- ECDHE key exchange for forward secrecy
- HSTS with max-age >= 31536000
- No known vulnerabilities (BEAST, POODLE, Heartbleed)

---

## 14. Summary of Key Recommendations

### Immediate Actions (Week 1)
1. Install and configure `helmet`, `express-rate-limit`, and `cors` middleware
2. Implement 6-layer file upload validation (MIME + extension + magic numbers + Sharp + UUID + rate limit)
3. Enable structured audit logging with Winston (user + action + timestamp + resource)
4. Configure TLS 1.3 with strong cipher suites

### Short-term (Month 1)
5. Implement JWT authentication with refresh token rotation
6. Set up RBAC with documented role definitions
7. Configure AES-256 encryption at rest (S3 SSE-KMS) and TLS 1.3 in transit
8. Move all secrets to AWS Secrets Manager or HashiCorp Vault
9. Implement automated data retention cleanup
10. Add npm audit and Snyk scanning to CI/CD pipeline

### Medium-term (Quarter 1)
11. Deploy SIEM integration for centralized log management
12. Conduct quarterly access reviews with documentation
13. Write and approve incident response plan
14. Conduct tabletop exercise and document results
15. Complete penetration test
16. Implement MFA enforcement for all admin access

### Ongoing
17. Weekly vulnerability scan reviews
18. Monthly dependency updates
19. Quarterly access reviews
20. Annual IRP review and tabletop exercise
21. Annual penetration test

---

## Citations

[^16^] Bytebase - "SOC 2 Audit Log Requirements: Lessons From Our Own Audit" (2026) - https://www.bytebase.com/blog/soc2-audit-logging/

[^17^] Konfirmity - "SOC 2 Encryption Requirements: A Walkthrough with Templates" (2026) - https://www.konfirmity.com/blog/soc-2-encryption-requirements

[^18^] Security Docs - "SOC 2 Encryption Requirements: Data at Rest, In Transit, and Key Management" (2026) - https://security-docs.com/blog/soc2-encryption-standards

[^19^] Copla - "SOC 2 encryption requirements: Key guidelines for data security" (2026) - https://copla.com/blog/compliance-regulations/soc-2-encryption-requirements-key-guidelines-for-data-security/

[^20^] VerifyWise - "SOC 2 Type II compliance: Trust Service Criteria, controls, and audit prep" - https://verifywise.ai/solutions/soc2

[^22^] Drata - "Trust Services Criteria for SOC 2: What You Need to Know" - https://drata.com/learn/soc-2/trust-services-criteria

[^23^] Pun Group CPA - "SOC 2 Trust Services Criteria 101" - https://pungroup.cpa/blog/soc-2-trust-services-criteria/

[^34^] CoreUI - "How to implement rate limiting in Node.js" (2026) - https://coreui.io/answers/how-to-implement-rate-limiting-in-nodejs/

[^36^] SVG Genie - "How to Prevent XSS in SVG File Uploads" (2025) - https://www.svggenie.com/blog/svg-security-best-practices

[^37^] Episki - "SOC 2 Incident Response: CC7.3/7.4" (2026) - https://episki.com/frameworks/soc2/incident-response

[^38^] OneUptime - "How to Use Helmet for Security in Express.js" (2026) - https://oneuptime.com/blog/post/2026-01-25-helmet-security-expressjs/view

[^39^] Truvocyber - "SOC 2 Incident Response for On-Premise Environments" (2026) - https://truvocyber.com/blog/soc2-incident-response-on-prem

[^40^] Rafter - "SCA Tools Comparison: Snyk vs Dependabot vs Renovate" (2026) - https://rafter.so/blog/sca-tools-comparison

[^41^] Creately - "SOC 2 Incident Notification Process" - https://creately.com/process/soc2/incident-notification/

[^42^] OneUptime - "How to Handle Dependency Vulnerability Scanning" (2026) - https://oneuptime.com/blog/post/2026-01-24-dependency-vulnerability-scanning/view

[^43^] Dev.to - "API Rate Limiting in Node.js: Strategies and Best Practices" (2025) - https://dev.to/hamzakhan/api-rate-limiting-in-nodejs-strategies-and-best-practices-3gef

[^44^] Medium - "Detecting Vulnerabilities in Node.js APIs with Code Analysis Tools" (2024) - https://medium.com/@erickzanetti/detecting-vulnerabilities-in-node-js-apis-with-code-analysis-tools-61009d52df06

[^45^] Better Stack - "Rate Limiting in Express.js" (2025) - https://betterstack.com/community/guides/scaling-nodejs/rate-limiting-express/

[^46^] Helmet.js GitHub - "Help secure Express apps with various HTTP headers" - https://github.com/helmetjs/helmet

[^47^] AppSignal - "How to Implement Rate Limiting in Express for Node.js" (2024) - https://blog.appsignal.com/2024/04/03/how-to-implement-rate-limiting-in-express-for-nodejs.html

[^48^] NamasteDev - "Implementing Secure REST APIs with Node.js and Express" (2026) - https://namastedev.com/blog/implementing-secure-rest-apis-with-node-js-and-express/

[^49^] Konfirmity - "SOC 2 Breach Notification Guide" (2026) - https://www.konfirmity.com/blog/soc-2-breach-notification-guide

[^50^] Medium - "Secure Your Express.js App with Helmet.js" (2025) - https://medium.com/@nayanprakashbhai/secure-your-express-js-app-with-helmet-js-ac5294e2b730

[^66^] SOC2Auditors - "SOC 2 Security Controls: CC6 & CC7 Deep-Dive" (2026) - https://soc2auditors.org/insights/soc-2-security-controls/

[^67^] Red Gate - "Test Data Management and SOC 2 Compliance" (2026) - https://www.red-gate.com/blog/test-data-management-and-soc-2-compliance/

[^68^] OneUptime - "How to Build Token Rotation Strategies" (2026) - https://oneuptime.com/blog/post/2026-01-30-token-rotation-strategies/view

[^69^] Glocert - "SOC 2 Readiness Checklist: Audit Preparation Guide" (2026) - https://www.glocertinternational.com/resources/guides/soc-2-readiness-checklist/

[^70^] Watchdog Security - "Retain Personal Information Securely Compliance" (2026) - https://watchdogsecurity.io/soc2/retain-personal-information-securely

[^71^] Logto - "Analyzing identity authentication under SOC 2 and GDPR" (2025) - https://blog.logto.io/auth-soc2-gdpr

[^72^] CoreUI - "How to validate file uploads in Node.js" (2025) - https://coreui.io/answers/how-to-validate-file-uploads-in-nodejs/

[^73^] freeCodeCamp - "How to Build a Secure Authentication System with JWT and Refresh Tokens" (2025) - https://www.freecodecamp.org/news/how-to-build-a-secure-authentication-system-with-jwt-and-refresh-tokens/

[^74^] GetSecureSlate - "SOC 2 Controls: Full List, Use Cases, and What Auditors Expect" (2026) - https://getsecureslate.com/blog/soc-2-controls-full-list-use-cases-and-what-auditors-expect

[^75^] DigitalOcean - "How To Use JSON Web Tokens (JWTs) in Express.js" (2025) - https://www.digitalocean.com/community/tutorials/nodejs-jwt-expressjs

[^76^] Sprinto - "SOC 2 Password Requirements for Compliance" (2026) - https://sprinto.com/blog/soc-2-password-requirements/

[^107^] Dev.to - "Node.js Secret Management in Production" (2026) - https://dev.to/axiom_agent/nodejs-secret-management-in-production-vault-aws-secrets-manager-and-zero-leakage-patterns-21a6

[^108^] huyha.zone - "Node.js File Upload with Multer (Complete Guide)" (2025) - https://huyha.zone/blog/post/nodejs-file-upload-multer-complete-guide/

[^109^] ISMS.online - "SOC 2 Controls - System Operations CC7.2 Explained" (2025) - https://www.isms.online/soc-2/controls/system-operations-cc7-2-explained/

[^110^] OneUptime - "How to Create File Upload API in Node.js" (2026) - https://oneuptime.com/blog/post/2026-01-22-nodejs-file-upload-api/view

[^111^] PolicyLayer - "SOC 2 Compliance for AI Agents" (2025) - https://policylayer.com/blog/soc2-compliance-ai-agents

[^112^] Bastion.tech - "Secrets Management 101: Stop Storing Credentials in .env Files" (2026) - https://bastion.tech/blog/secrets-management-101-stop-storing-credentials-in-env-files/

[^113^] Medium - "How to secure File Upload on ExpressJs using Multer" (2025) - https://medium.com/@tahaharbouch1/toward-secure-code-how-to-secure-file-upload-on-expressjs-using-multer-6598b1715bb4

[^114^] DesignCS - "SOC 2 CC7: Common Criteria related to System Operations" (2024) - https://www.designcs.net/soc-2-cc7-common-criteria-related-to-system-operations/

[^115^] OpenReview - "(In)Security of File Uploads in Node.js" - https://openreview.net/pdf?id=thJGSQcS5y

---

*Document generated for SOC2 Type II audit preparation. All recommendations are based on AICPA Trust Services Criteria (2017 edition, revised 2022) with current industry best practices as of 2025-2026.*
