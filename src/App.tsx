import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, Image as ImageIcon, Loader2, AlertCircle, Sun, Moon, Download, Globe, Undo, Redo, Archive, Trash2, Settings, Zap, List, ChevronDown, RefreshCw, ZoomIn, ZoomOut, Maximize, GripVertical, Plus, Edit2 } from 'lucide-react';
import JSZip from 'jszip';
import { GoogleGenAI } from "@google/genai";
import { LayerEditor } from './LayerEditor';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

interface HistoryState {
  svg: string;
  png: string;
}

interface UploadItem {
  id: string;
  file: File;
  preview: string;
  jobId: string | null;
  status: 'idle' | 'processing' | 'completed' | 'failed';
  pngBase64: string | null;
  svgBase64: string | null;
  error?: string;
  progressStage: number;
  
  history: HistoryState[];
  historyIndex: number;
}

const SYSTEM_INSTRUCTION = (quality: string) => `You are a world-class, elite vector graphics AI engine. Your sole objective is to surgically trace the provided raster image and reconstruct it into a production-ready, mathematically pristine SVG.

CRITICAL DIRECTIVES:
1. MATHEMATICAL PRECISION: Trace all shapes with exact geometric mastery. Completely eliminate wobbly, shaky, or imprecise lines. Employ minimal, mathematically optimal Bezier curves and utilize geometric primitives (<circle>, <rect>, <polygon>) wherever structurally sound.
2. FLAWLESS PATH LOGIC: You MUST use proper SVG fill rules (e.g., \`fill-rule="evenodd"\`) to elegantly handle compound paths, donut-holes, and precise cutouts. Do NOT use crude overlapping patches.
3. TRANSPARENT BACKGROUND: ABOLISH solid background rectangles. The overarching canvas MUST be transparent. Only include backgrounds if they are inextricably part of the logo's intrinsic design.
4. SEMANTIC HIERARCHY & ACCESSIBILITY: Group structurally related paths within \`<g>\` tags. Maintain absolute strictness with z-depth layering, from back (bottom) to front (top). You MUST include proper accessibility attributes on the root \`<svg>\` element (e.g. \`role="img"\`, \`aria-label="Image description"\`) and provide a descriptive \`<title>\` and \`<desc>\` element right inside the SVG root to ensure screen-reader compatibility.
5. MANDATORY LAYER NAMING: EVERY distinct semantic part MUST be wrapped in a \`<g>\` tag containing a highly descriptive \`data-name="Your Element Name"\`. Example: <g data-name="Inner Ring">. This is NON-NEGOTIABLE. Without this, the UI layer editor will catastrophically fail.
6. SCALABILITY: Define a precise, tight bounding \`viewBox\` (e.g., \`viewBox="0 0 500 500"\`). Do NOT hardcode fixed pixel width/height without an accompanying viewBox.
7. DETAIL PROFILE [${quality.toUpperCase()}]: ${
  quality === 'minimal' ? 'Extremist Minimalism. Vigorously simplify shapes, ruthlessly flatten gradients into solid colors, and eradicate micro-noise. Output the absolute lowest possible anchor count while retaining core recognition.' 
  : quality === 'optimized' ? 'Supreme Optimization. Strike an immaculate balance between high visual fidelity and lean, clean path data.' 
  : 'Hyper-Fidelity. Yield a flawless, pixel-perfect, exhaustively detailed vector tracing. Maintain razor-sharp anchor placement and meticulous curve fitting.'
}
8. CLEAN STYLING: Enforce inline attributes (\`fill="..."\`, \`stroke="..."\`). FORBID the use of global \`<style>\` blocks that pollute the DOM. Guarantee all numerical coordinates are pristine and valid.
9. ABSOLUTE ZERO FORMATTING: Output EXCLUSIVELY raw, valid XML/SVG code. Start with \`<svg>\` and end with \`</svg>\`. ZERO markdown (\`\`\`svg). ZERO conversational text. ZERO HTML wrappers. Your response must be parsed immediately by a strict XML parser.
Failure to follow these directives will result in system failure. Act as the ultimate vectorization compiler.`;

const processImageFrontend = async (file: File, colorQuant: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (img.width < 100 || img.height < 100) {
         reject(new Error(`Image too small (${img.width}x${img.height}). Minimum dimensions are 100x100 pixels.`));
         return;
      }
      
      let width = img.width;
      let height = img.height;
      if (width > 800 || height > 800) {
        if (width > height) {
          height = Math.round((height * 800) / width);
          width = 800;
        } else {
          width = Math.round((width * 800) / height);
          height = 800;
        }
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      
      ctx.drawImage(img, 0, 0, width, height);
      if (colorQuant === 'grayscale') {
         const imgData = ctx.getImageData(0, 0, width, height);
         const data = imgData.data;
         for (let i = 0; i < data.length; i += 4) {
           const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
           data[i] = avg; 
           data[i + 1] = avg; 
           data[i + 2] = avg; 
         }
         ctx.putImageData(imgData, 0, 0);
      }
      
      const dataUrl = canvas.toDataURL('image/png');
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = url;
  });
};

export default function App() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  
  const [isDark, setIsDark] = useState(true);
  const [queueStats, setQueueStats] = useState({ pending: 0, processing: 0, completed: 0, failed: 0, total: 0 });
  
  const [simplifyPaths, setSimplifyPaths] = useState(true);
  const [removeMetadata, setRemoveMetadata] = useState(false);
  const [pathFitting, setPathFitting] = useState(true);
  const [strokeOpt, setStrokeOpt] = useState(true);
  const [colorQuant, setColorQuant] = useState(false);
  const [advancedSVGO, setAdvancedSVGO] = useState(false);
  const [customWidth, setCustomWidth] = useState<number>(2000);
  const [customHeight, setCustomHeight] = useState<number>(2000);
  const [strokeWidth, setStrokeWidth] = useState<number>(1);
  const [quality, setQuality] = useState('high'); // 'high', 'optimized', 'minimal'
  const [model, setModel] = useState('gemini-3.1-pro-preview'); 
  const [isModelSelectOpen, setIsModelSelectOpen] = useState(false);
  const [isModelChanging, setIsModelChanging] = useState(false);
  
  const [hoveredLegend, setHoveredLegend] = useState<{name: string, props: Record<string, string>} | null>(null);
  const [legendItems, setLegendItems] = useState<{name: string, props: Record<string, string>}[]>([]);
  const [validationErrors, setValidationErrors] = useState<{line: number, desc: string}[] | null>(null);

  const [zoomScale, setZoomScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [dragPart, setDragPart] = useState<{name: string, ox: number, oy: number, tx: number, ty: number, realX: number, realY: number} | null>(null);

  const [showBatchConfirm, setShowBatchConfirm] = useState(false);
  const [user, setUser] = useState<{name: string, picture?: string} | null>(() => {
    const saved = localStorage.getItem('appUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [failedItemDetails, setFailedItemDetails] = useState<string | null>(null);
  const [showDownloadAllConfirm, setShowDownloadAllConfirm] = useState(false);
  
  const [selectedPart, setSelectedPart] = useState<{name: string, props: Record<string, string>} | null>(null);
  const [partFillColor, setPartFillColor] = useState('#000000');
  
  const updateSvgElementColor = async (itemId: string, name: string, color: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item?.svgBase64) return;
    
    try {
      const rawSvg = atob(item.svgBase64);
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawSvg, "image/svg+xml");
      const elements = doc.querySelectorAll(`[data-name="${name}"]`);
      elements.forEach(el => {
        if (el.hasAttribute('fill') && el.getAttribute('fill') !== 'none') el.setAttribute('fill', color);
        if (el.hasAttribute('stroke') && el.getAttribute('stroke') !== 'none') el.setAttribute('stroke', color);
        if (!el.hasAttribute('fill') && !el.hasAttribute('stroke')) el.setAttribute('fill', color);
      });
      
      const svgEl = doc.querySelector('svg');
      if (svgEl) {
        if (!svgEl.getAttribute('viewBox')) {
           const width = parseInt(svgEl.getAttribute('width') || '1000');
           const height = parseInt(svgEl.getAttribute('height') || '1000');
           svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
        }
        svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svgEl.setAttribute('width', '100%');
        svgEl.setAttribute('height', '100%');
      }
      
      const serializer = new XMLSerializer();
      const newSvgStr = serializer.serializeToString(doc);
      const newSvgBase64 = btoa(newSvgStr);
      
      // Update history
      updateItemSuccess(itemId, item.pngBase64 || '', newSvgBase64);
    } catch (e) {
      console.error(e);
    }
  };
  
  const { t, i18n } = useTranslation();
  
  const progressStages = [
    t("progress1"),
    t("progress2"),
    t("progress3"),
    t("progress4"),
    t("progress5"),
    t("progress6")
  ];

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/v1/queue-stats');
        if (res.ok) {
          const data = await res.json();
          setQueueStats(data);
        }
      } catch (err) {}
    };
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (filesList: FileList | File[]) => {
    const newItems: UploadItem[] = [];
    const filesArray = Array.from(filesList) as File[];
    filesArray.forEach(selected => {
      const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
      let errorMsg = undefined;
      let status: 'idle' | 'failed' = 'idle';

      if (!validTypes.includes(selected.type)) {
        errorMsg = t('errorInvalidType');
        status = 'failed';
      } else if (selected.size > 5 * 1024 * 1024) {
        errorMsg = t('errorSizeLimit');
        status = 'failed';
      }

      const objectUrl = URL.createObjectURL(selected);
      newItems.push({
        id: crypto.randomUUID(),
        file: selected,
        preview: objectUrl,
        jobId: null,
        status,
        error: errorMsg,
        progressStage: 0,
        pngBase64: null,
        svgBase64: null,
        history: [],
        historyIndex: -1,
      });
    });
    
    if (newItems.length > 0) {
      setItems(prev => [...prev, ...newItems]);
      if (!activeItemId) setActiveItemId(newItems[0].id);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    // Reset to allow re-uploading the same file
    if(e.target) e.target.value = '';
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    if (activeItemId === id) {
      setActiveItemId(null);
    }
  };

  const processItem = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'processing', error: undefined, progressStage: 1 } : i));

    try {
      if (model.includes('pro') || model.includes('flash-image') || model.includes('veo')) {
        if (window.aistudio && window.aistudio.hasSelectedApiKey) {
           const hasKey = await window.aistudio.hasSelectedApiKey();
           if (!hasKey) {
             if (window.aistudio.openSelectKey) {
                await window.aistudio.openSelectKey();
             }
           }
        }
      }

      setItems(prev => prev.map(i => i.id === itemId ? { ...i, progressStage: 2 } : i));
      const resultBase64 = await processImageFrontend(item.file, colorQuant.toString());
      
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const promptStr = "Convert this logo to SVG according to your system instructions.";
      
      const responseStream = await ai.models.generateContentStream({
        model: model,
        contents: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: resultBase64
            }
          },
          promptStr
        ],
        config: {
          temperature: 0.0,
          systemInstruction: SYSTEM_INSTRUCTION(quality),
        }
      });
      
      let rawSvg = "";
      for await (const chunk of responseStream) {
        if (chunk.text) {
          rawSvg += chunk.text;
        }
      }
      
      if (!rawSvg) {
        throw new Error("Gemini generated an empty response or hit a safety filter. Please try another image.");
      }

      let parsedSvg = rawSvg.trim();
      if (parsedSvg.startsWith('```')) {
         parsedSvg = parsedSvg.replace(/```xml\n?|```svg\n?|```\n?/g, '');
         const lastTick = parsedSvg.lastIndexOf('```');
         if (lastTick !== -1) {
             parsedSvg = parsedSvg.substring(0, lastTick);
         }
      }
      parsedSvg = parsedSvg.trim();

      setItems(prev => prev.map(i => i.id === itemId ? { ...i, progressStage: 3 } : i));

      const optimizeOptions = {
         simplifyPaths: simplifyPaths.toString() === 'true',
         removeMetadata: removeMetadata.toString() === 'true',
         pathFitting: pathFitting.toString() === 'true',
         strokeOpt: strokeOpt.toString() === 'true',
         colorQuant: colorQuant.toString()
      };

      const optResponse = await fetch('/api/v1/optimize-svg', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ svgBase64: btoa(unescape(encodeURIComponent(parsedSvg))), options: optimizeOptions })
      });

      if (!optResponse.ok) {
         const errData = await optResponse.json().catch(() => ({}));
         throw new Error(errData.error || t('errorProcess'));
      }

      const optData = await optResponse.json();
      updateItemSuccess(itemId, resultBase64, optData.svgBase64);

    } catch (err: any) {
       setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'failed', error: err.message || t('errorProcess') } : i));
    }
  };

  const updateItemSuccess = (itemId: string, png: string, svg: string) => {
    setItems(prev => prev.map(i => {
      if (i.id === itemId) {
        const historyCopy = i.history.slice(0, i.historyIndex + 1);
        const newHistory = [...historyCopy, { png, svg }];
        return { 
          ...i, 
          status: 'completed', 
          pngBase64: png, 
          svgBase64: svg, 
          history: newHistory,
          historyIndex: newHistory.length - 1,
          progressStage: 5 
        };
      }
      return i;
    }));
  };

  const pollStatus = async (itemId: string, jobId: string) => {
    try {
      const res = await fetch(`/api/v1/status/${jobId}`);
      if (!res.ok) throw new Error('Poll failed');
      const data = await res.json();

      if (data.status === 'completed') {
        updateItemSuccess(itemId, data.resultBase64, data.svgBase64);
      } else if (data.status === 'failed') {
        setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'failed', error: data.error } : i));
      } else {
        // still processing
        setItems(prev => prev.map(i => {
          if (i.id === itemId && i.progressStage < 4) {
             return { ...i, progressStage: i.progressStage + 1 };
          }
          return i;
        }));
        setTimeout(() => pollStatus(itemId, jobId), 2000);
      }
    } catch (err) {
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'failed', error: 'Polling error' } : i));
    }
  };

  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchSummary, setBatchSummary] = useState<{show: boolean, failed: string[]}>({show: false, failed: []});

  const processAll = () => {
    setIsBatchProcessing(true);
    let toProcess = 0;
    items.forEach(item => {
      if (item.status === 'idle' || item.status === 'failed') {
        toProcess++;
        processItem(item.id);
      }
    });
    if (toProcess === 0) setIsBatchProcessing(false);
  };

  useEffect(() => {
    if (isBatchProcessing) {
       const hasPending = items.some(i => i.status === 'processing' || i.status === 'idle');
       if (!hasPending) {
          setIsBatchProcessing(false);
          const failedIds = items.filter(i => i.status === 'failed').map(i => i.id);
          if (failedIds.length > 0) {
             setBatchSummary({show: true, failed: failedIds});
          }
       }
    }
  }, [items, isBatchProcessing]);

  const [previewSvgStr, setPreviewSvgStr] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  useEffect(() => {
     const runPreview = async () => {
         const item = items.find(i => i.id === activeItemId);
         if (!item?.svgBase64 || item.status !== 'completed') {
            setPreviewSvgStr(null);
            return;
         }
         setIsPreviewLoading(true);
         try {
            const response = await fetch('/api/v1/optimize-svg', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                svgBase64: item.svgBase64, 
                options: { simplifyPaths, removeMetadata, pathFitting, strokeOpt, colorQuant } 
              }),
            });
            if (response.ok) {
               const data = await response.json();
               if (data.svgBase64 !== item.svgBase64) {
                 setPreviewSvgStr(data.svgBase64);
               } else {
                 setPreviewSvgStr(null); // No changes detected
               }
            } else {
              setPreviewSvgStr(null);
            }
         } catch(e) {
            setPreviewSvgStr(null);
         }
         setIsPreviewLoading(false);
     };
     const t = setTimeout(runPreview, 500);
     return () => clearTimeout(t);
  }, [activeItemId, items, simplifyPaths, removeMetadata, pathFitting, strokeOpt, colorQuant]);

  const handleApplyPreview = async (itemId: string) => {
     if (!previewSvgStr) return;
     const item = items.find(i => i.id === itemId);
     if (!item) return;
     updateItemSuccess(itemId, item.pngBase64 || '', previewSvgStr);
     setPreviewSvgStr(null);
  };

  const handleReoptimize = async (itemId: string) => {
    // legacy fallback
    const item = items.find(i => i.id === itemId);
    if (!item?.svgBase64) return;
    
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'processing', progressStage: 3 } : i));
    
    try {
      const response = await fetch('/api/v1/optimize-svg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          svgBase64: item.svgBase64, 
          options: { simplifyPaths, removeMetadata, pathFitting, strokeOpt, colorQuant } 
        }),
      });

      if (!response.ok) throw new Error('Optimize failed');
      const data = await response.json();
      updateItemSuccess(itemId, data.resultBase64, data.svgBase64);
    } catch (err) {
      setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: 'failed', error: 'Optimize failed' } : i));
    }
  };

  const parseDimensionsFromSvg = (svgStr: string) => {
    try {
      const rawSvg = atob(svgStr);
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawSvg, "image/svg+xml");
      const svgEl = doc.querySelector('svg');
      let w = 2000, h = 2000, sw = 1;
      if (svgEl) {
        if (svgEl.hasAttribute('width')) w = parseInt(svgEl.getAttribute('width') || '2000');
        if (svgEl.hasAttribute('height')) h = parseInt(svgEl.getAttribute('height') || '2000');
        const styleEl = svgEl.querySelector('style.export-settings-stroke');
        if (styleEl) {
          const match = styleEl.textContent?.match(/stroke-width:\s+([\d.]+)px/i) || styleEl.textContent?.match(/stroke-width:\s+([\d.]+)/i);
          if (match && match[1]) sw = parseFloat(match[1]);
        }
      }
      return { w, h, sw };
    } catch {
      return { w: 2000, h: 2000, sw: 1 };
    }
  };

  const handleUndo = (itemId: string) => {
    setItems(prev => prev.map(i => {
      if (i.id === itemId && i.historyIndex > 0) {
        const newIndex = i.historyIndex - 1;
        const newSvgBase64 = i.history[newIndex].svg;
        
        if (itemId === activeItemId) {
          const { w, h, sw } = parseDimensionsFromSvg(newSvgBase64);
          setCustomWidth(w);
          setCustomHeight(h);
          setStrokeWidth(sw);
        }

        return {
          ...i,
          historyIndex: newIndex,
          pngBase64: i.history[newIndex].png,
          svgBase64: newSvgBase64,
        };
      }
      return i;
    }));
  };

  const handleRedo = (itemId: string) => {
    setItems(prev => prev.map(i => {
      if (i.id === itemId && i.historyIndex < i.history.length - 1) {
        const newIndex = i.historyIndex + 1;
        const newSvgBase64 = i.history[newIndex].svg;

        if (itemId === activeItemId) {
          const { w, h, sw } = parseDimensionsFromSvg(newSvgBase64);
          setCustomWidth(w);
          setCustomHeight(h);
          setStrokeWidth(sw);
        }

        return {
          ...i,
          historyIndex: newIndex,
          pngBase64: i.history[newIndex].png,
          svgBase64: newSvgBase64,
        };
      }
      return i;
    }));
  };

  const downloadAllZip = async () => {
    const zip = new JSZip();
    const completedItems = items.filter(i => i.status === 'completed' && i.svgBase64 && i.pngBase64);
    if (completedItems.length === 0) return;

    completedItems.forEach((item) => {
      const name = item.file.name.replace(/\.[^/.]+$/, "");
      zip.file(`${name}.svg`, atob(item.svgBase64!), {base64: false});
      zip.file(`${name}.png`, item.pngBase64!, {base64: true});
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = 'vectorized_logos.zip';
    link.click();
  };

  const downloadItemZip = async (item: UploadItem) => {
    if (!item.svgBase64 || !item.pngBase64) return;
    const name = item.file.name.replace(/\.[^/.]+$/, "");
    const modifiedSvg = atob(item.svgBase64);
    const zip = new JSZip();
    zip.file(`${name}.svg`, modifiedSvg, {base64: false});
    zip.file(`${name}.png`, item.pngBase64, {base64: true});
    const content = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `${name}_vectorized.zip`;
    link.click();
  };

  const applyExportSettings = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item?.svgBase64) return;
    try {
      const rawSvg = atob(item.svgBase64);
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawSvg, "image/svg+xml");
      const svgEl = doc.querySelector('svg');
      if (svgEl) {
        if (!svgEl.getAttribute('viewBox')) {
           const origWidth = parseInt(svgEl.getAttribute('width') || '1000');
           const origHeight = parseInt(svgEl.getAttribute('height') || '1000');
           svgEl.setAttribute('viewBox', `0 0 ${origWidth} ${origHeight}`);
        }
        svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        
        if (customWidth > 0) svgEl.setAttribute('width', customWidth.toString());
        else svgEl.removeAttribute('width');
        
        if (customHeight > 0) svgEl.setAttribute('height', customHeight.toString());
        else svgEl.removeAttribute('height');
        
        const oldStyles = svgEl.querySelectorAll('style.export-settings-stroke');
        oldStyles.forEach(s => s.remove());
        
        if (strokeWidth !== 1) {
          const style = doc.createElement('style');
          style.className = 'export-settings-stroke';
          style.textContent = `* { stroke-width: ${strokeWidth} !important; }`;
          svgEl.appendChild(style);
        }
      }
      const serializer = new XMLSerializer();
      const newSvgStr = serializer.serializeToString(doc);
      const newSvgBase64 = btoa(newSvgStr);
      if (newSvgBase64 !== item.svgBase64) {
         updateItemSuccess(itemId, item.pngBase64 || '', newSvgBase64);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const downloadIndividualSvg = (item: UploadItem) => {
    if (!item.svgBase64) return;
    const modifiedSvgContext = item.svgBase64;
    const link = document.createElement('a');
    link.href = `data:image/svg+xml;base64,${modifiedSvgContext}`;
    link.download = `${item.file.name.replace(/\.[^/.]+$/, "")}.svg`;
    link.click();
  };

  const handleGoogleLogin = async () => {
    try {
      const response = await fetch('/api/auth/url');
      if (!response.ok) throw new Error('Failed to get auth URL');
      const { url } = await response.json();
      window.open(url, 'oauth_popup', 'width=500,height=600');
    } catch (error) {
      console.error('OAuth error:', error);
    }
  };

  useEffect(() => {
    const item = items.find(i => i.id === activeItemId);
    let parsedWidth = 2000, parsedHeight = 2000, parsedStroke = 1;
    if (item?.svgBase64) {
      try {
        const rawSvg = atob(item.svgBase64);
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawSvg, "image/svg+xml");
        const svgEl = doc.querySelector('svg');
        if (svgEl) {
           const w = svgEl.getAttribute('width');
           if (w && !w.includes('%')) parsedWidth = parseInt(w);
           const h = svgEl.getAttribute('height');
           if (h && !h.includes('%')) parsedHeight = parseInt(h);
           const style = svgEl.querySelector('style.export-settings-stroke');
           if (style && style.textContent) {
              const match = style.textContent.match(/stroke-width:\s*([\d.]+)/);
              if (match) parsedStroke = parseFloat(match[1]);
           }
        }
      } catch (e) {
        /* Ignore */
      }
    }
    setCustomWidth(parsedWidth);
    setCustomHeight(parsedHeight);
    setStrokeWidth(parsedStroke);
  }, [activeItemId, items.find(i => i.id === activeItemId)?.historyIndex]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const loggedInUser = event.data?.user || { name: "Authenticated User" };
        setUser(loggedInUser);
        localStorage.setItem('appUser', JSON.stringify(loggedInUser));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Extract legend items when active item changes
  const activeItem = items.find(i => i.id === activeItemId);
  useEffect(() => {
    if (activeItem?.svgBase64) {
      try {
        const rawSvg = atob(activeItem.svgBase64);
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawSvg, "image/svg+xml");
        const elementsWithDataName = doc.querySelectorAll("[data-name]");
        const extracted = Array.from(elementsWithDataName).map(el => {
          const name = el.getAttribute('data-name');
          if (!name) return null;
          const props: Record<string, string> = {};
          if (el.getAttribute('fill')) props.fill = el.getAttribute('fill')!;
          if (el.getAttribute('stroke')) props.stroke = el.getAttribute('stroke')!;
          if (el.getAttribute('id')) props.id = el.getAttribute('id')!;
          if (el.getAttribute('opacity')) props.opacity = el.getAttribute('opacity')!;
          if (el.tagName === 'path') {
            const d = el.getAttribute('d') || '';
            props.pathLength = d.length.toString() + ' chars';
          }
          return { name, props };
        }).filter(Boolean) as {name: string, props: Record<string, string>}[];
        
        // Deduplicate by name
        const unique = extracted.reduce((acc, current) => {
          if (!acc.find(item => item.name === current.name)) {
            acc.push(current);
          }
          return acc;
        }, [] as {name: string, props: Record<string, string>}[]);
        
        setLegendItems(unique);

        const errors = [];
        const errNodes = doc.querySelectorAll("parsererror");
        if (errNodes.length > 0) {
          errors.push({ line: 1, desc: errNodes[0].textContent || 'XML Parsing Error' });
        }
        const svgEl = doc.querySelector('svg');
        if (svgEl && !svgEl.getAttribute('viewBox')) {
           errors.push({ line: 1, desc: 'Warning: Missing viewBox attribute limits scalability.' });
        }
        if (doc.querySelectorAll('script').length > 0) {
           errors.push({ line: 1, desc: 'Warning: <script> tags present, potentially unsafe.' });
        }
        if (doc.querySelectorAll('image').length > 0) {
           errors.push({ line: 1, desc: 'Warning: Contains embedded raster <image> instead of pure vectors.' });
        }
        setValidationErrors(errors.length > 0 ? errors : null);
      } catch (e) {
        setLegendItems([]);
        setValidationErrors([{ line: 1, desc: 'Critical error parsing SVG.' }]);
      }
    } else {
      setLegendItems([]);
      setValidationErrors(null);
    }
  }, [activeItem?.svgBase64]);

  const activeSvgHtml = previewSvgStr ? atob(previewSvgStr) : (activeItem?.svgBase64 ? atob(activeItem.svgBase64) : null);

  const [interactiveSvgHtml, setInteractiveSvgHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!activeSvgHtml) {
      setInteractiveSvgHtml(null);
      return;
    }
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(activeSvgHtml, "image/svg+xml");
      const elementsWithDataName = doc.querySelectorAll("[data-name]");
      elementsWithDataName.forEach(el => {
        const name = el.getAttribute('data-name');
        if (name && !el.querySelector('title')) {
          const title = doc.createElement('title');
          const props = Array.from(el.attributes)
            .filter(a => ['fill', 'stroke', 'opacity', 'd', 'id', 'stroke-width'].includes(a.name))
            .map(a => `${a.name}: ${a.name === 'd' ? a.value.substring(0, 15) + '...' : a.value}`)
            .join(' | ');
          title.textContent = `data-name: ${name}\n\nProperties:\n${props.replace(/ \\| /g, '\n')}`;
          el.insertBefore(title, el.firstChild);
        }
      });
      const serializer = new XMLSerializer();
      setInteractiveSvgHtml(serializer.serializeToString(doc));
    } catch(e) {
      setInteractiveSvgHtml(activeSvgHtml);
    }
  }, [activeSvgHtml]);

  const themeClasses = isDark 
    ? {
      bg: "bg-[#0A0A0A]",
      textPrimary: "text-[#F5F5F5]",
      bgSecondary: "bg-[#141414]",
      borderPrimary: "border-white/10",
      borderSecondary: "border-white/20",
      textMuted: "text-white/60",
      textSemiMuted: "text-white/80",
      accentDot: "bg-white",
      hoverBg: "hover:bg-white/[0.04]",
      iconBg: "bg-white/5",
      ringFocus: "focus:ring-offset-[#0A0A0A]",
      gridColor: "radial-gradient(#ffffff 2px, transparent 2px)",
      loaderBg: "bg-[#141414]",
      shadow: "drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]",
      downloadBtn: "bg-white/10 text-white hover:bg-white/20 border-white/10",
      btnPrimary: "bg-white text-black hover:bg-white/90 border-transparent",
    }
    : {
      bg: "bg-[#F5F5F5]",
      textPrimary: "text-[#0A0A0A]",
      bgSecondary: "bg-white",
      borderPrimary: "border-black/10",
      borderSecondary: "border-black/20",
      textMuted: "text-black/60",
      textSemiMuted: "text-black/80",
      accentDot: "bg-black",
      hoverBg: "hover:bg-black/[0.02]",
      iconBg: "bg-black/5",
      ringFocus: "focus:ring-offset-white",
      gridColor: "radial-gradient(#000000 2px, transparent 2px)",
      loaderBg: "bg-white",
      shadow: "drop-shadow-[0_0_20px_rgba(0,0,0,0.15)]",
      downloadBtn: "bg-black/10 text-black hover:bg-black/20 border-black/10",
      btnPrimary: "bg-black text-white hover:bg-black/90 border-transparent",
    };

  const AI_MODELS = [
    { 
      id: 'gemini-3.1-pro-preview', 
      name: 'Gemini 3.1 Pro', 
      desc: t('descProModel'), 
      status: 'available', 
      estTime: '~15-20s', 
      quality: 'Ultra HD (99%)', 
      suitability: 'Complex gradient logos, illustrations, intricate layer structures.'
    },
    { 
      id: 'gemini-2.5-flash', 
      name: 'Gemini 2.5 Flash', 
      desc: t('descFlashModel'), 
      status: 'available', 
      estTime: '~5-8s', 
      quality: 'High (92%)', 
      suitability: 'Minimal abstract shapes, simple typography, flat colors.'
    },
    { 
      id: 'gemini-1.5-pro', 
      name: 'Gemini 1.5 Pro', 
      desc: t('descLegacyPro'), 
      status: 'unavailable', 
      estTime: '~12-18s', 
      quality: 'Very High (95%)', 
      suitability: 'Standard logos, reliable backward compatibility.'
    }
  ];

  const selectedModel = AI_MODELS.find(m => m.id === model) || AI_MODELS[0];

  return (
    <div 
      className={`min-h-screen ${themeClasses.bg} ${themeClasses.textPrimary} font-sans flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 transition-colors duration-300`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {isDragging && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
            <div className="flex flex-col items-center justify-center p-12 border-4 border-dashed border-emerald-500/50 rounded-3xl bg-emerald-500/10 shadow-[0_0_100px_rgba(16,185,129,0.2)]">
               <Upload className="w-16 h-16 text-emerald-500 mb-6 animate-bounce drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
               <h2 className="text-2xl font-bold tracking-widest uppercase text-emerald-500">{t('uploadTitle')}</h2>
               <p className="text-emerald-500/80 mt-2 font-mono uppercase tracking-wider text-sm">Drop your raster images anywhere to begin</p>
            </div>
         </div>
      )}
      {hoveredLegend && (
        <style dangerouslySetInnerHTML={{ __html: `
          .svg-container svg { width: 100%; height: 100%; max-height: 350px; object-fit: contain; }
          .svg-container svg * { stroke-width: ${strokeWidth} !important; }
          .svg-container [data-name] { transition: all 0.3s ease; opacity: 0.2; cursor: pointer; }
          .svg-container [data-name="${hoveredLegend.name}"] { opacity: 1 !important; stroke: #10b981; stroke-width: ${Math.max(2, strokeWidth * 2)}px !important; }
        `}} />
      )}
      {!hoveredLegend && (
        <style dangerouslySetInnerHTML={{ __html: `
          .svg-container svg { width: 100%; height: 100%; max-height: 350px; object-fit: contain; }
          .svg-container svg * { stroke-width: ${strokeWidth} !important; }
          .svg-container [data-name] { cursor: pointer; }
        `}} />
      )}
      
      <div className="max-w-[1200px] w-full space-y-10 flex flex-col">
        {/* Header Section */}
        <header className={`w-full border-b ${themeClasses.borderPrimary} pb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-colors duration-300`}>
          <div className="flex flex-col">
            <span className="text-[10px] tracking-[0.3em] uppercase opacity-50 font-semibold mb-2">{t('headerSub')}</span>
            <h1 className="text-3xl md:text-4xl font-light italic tracking-tight font-serif flex items-center gap-4">
              Logo<span className={`${isDark ? 'text-white' : 'text-black'} opacity-40 italic transition-colors duration-300`}>_Vectorizer</span>
              <button 
                 onClick={() => setIsDark(!isDark)}
                 className={`ml-4 p-2 rounded-full ${themeClasses.iconBg} ${themeClasses.hoverBg} transition-all duration-200 active:scale-90`}
                 title={t('themeToggleTooltip')}
                 aria-label={t('themeToggleTooltip')}
              >
                {isDark ? <Sun className="w-4 h-4 opacity-70" /> : <Moon className="w-4 h-4 opacity-70" />}
              </button>
            </h1>
          </div>
          <div className="flex items-center gap-4">
             {items.length > 0 && <button 
                onClick={() => {
                  const pendingCount = items.filter(i => i.status === 'idle' || i.status === 'failed').length;
                  if (pendingCount > 1) setShowBatchConfirm(true);
                  else processAll();
                }}
                className={`text-xs px-4 py-2 font-semibold uppercase tracking-wider rounded-lg border ${themeClasses.borderPrimary} bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 transition-all duration-200 active:scale-95`}
             >
                {t('processAllPending')}
             </button>}
             {items.filter(i => i.status === 'completed').length > 0 && <button 
                onClick={() => setShowDownloadAllConfirm(true)}
                className={`text-xs flex items-center gap-2 px-4 py-2 font-semibold uppercase tracking-wider rounded-lg border ${themeClasses.borderPrimary} bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 transition-all duration-200 active:scale-95`}
             >
                <Archive className="w-4 h-4" /> {t('downloadAllZip')}
             </button>}
          </div>
        </header>

        {showDownloadAllConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`p-6 rounded-2xl border ${themeClasses.borderPrimary} ${themeClasses.bgSecondary} max-w-sm w-full shadow-2xl`}>
              <h3 className="text-lg font-bold mb-2">{t('downloadAllConfirmTitle')}</h3>
              <p className={`text-sm mb-6 ${themeClasses.textSemiMuted}`}>
                {t('downloadAllConfirmMsg')}
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowDownloadAllConfirm(false)} className={`px-4 py-2 text-sm font-medium rounded-lg border ${themeClasses.borderSecondary} hover:bg-white/5 transition-all duration-200 active:scale-95`} aria-label={t('cancelBtn')}>
                  {t('cancelBtn')}
                </button>
                <button onClick={() => { setShowDownloadAllConfirm(false); downloadAllZip(); }} className="px-4 py-2 text-sm font-bold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white transition-all duration-200 active:scale-95" aria-label={t('confirmDownloadBtn')}>
                  {t('confirmDownloadBtn')}
                </button>
              </div>
            </div>
          </div>
        )}

        {showBatchConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className={`p-6 rounded-2xl border ${themeClasses.borderPrimary} ${themeClasses.bgSecondary} max-w-sm w-full shadow-2xl`}>
              <h3 className="text-lg font-bold mb-2">{t('batchConfirmTitle')}</h3>
              <p className={`text-sm mb-6 ${themeClasses.textSemiMuted}`}>
                {t('batchConfirmMsg').replace('{{count}}', items.filter(i => i.status === 'idle' || i.status === 'failed').length.toString())}
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowBatchConfirm(false)} className={`px-4 py-2 text-sm font-medium rounded-lg border ${themeClasses.borderSecondary} hover:bg-white/5 transition-all duration-200 active:scale-95`}>
                  {t('cancelBtn')}
                </button>
                <button onClick={() => { setShowBatchConfirm(false); processAll(); }} className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-all duration-200 active:scale-95">
                  {t('confirmBtn')}
                </button>
              </div>
            </div>
          </div>
        )}

        {failedItemDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setFailedItemDetails(null)} role="dialog" aria-modal="true" aria-labelledby="error-modal-title">
            <div className={`p-6 rounded-2xl border ${themeClasses.borderPrimary} ${themeClasses.bgSecondary} max-w-lg w-full shadow-2xl`} onClick={e => e.stopPropagation()}>
              <h3 id="error-modal-title" className="text-lg font-bold mb-2 text-red-500">{t('failedTitle')}</h3>
              <div className="bg-black/20 p-4 rounded-lg overflow-auto max-h-60 font-mono text-xs opacity-80 mb-6 whitespace-pre-wrap word-break">
                {failedItemDetails}
              </div>
              <div className="flex justify-end">
                <button onClick={() => setFailedItemDetails(null)} className={`px-4 py-2 text-sm font-medium rounded-lg border ${themeClasses.borderSecondary} hover:bg-white/5 transition-all duration-200 active:scale-95`} aria-label={t('closeBtn')}>{t('closeBtn')}</button>
              </div>
            </div>
          </div>
        )}

        {batchSummary.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setBatchSummary({show: false, failed: []})} role="dialog" aria-modal="true" aria-labelledby="batch-summary-title">
            <div className={`p-6 rounded-2xl border ${themeClasses.borderPrimary} ${themeClasses.bgSecondary} max-w-lg w-full shadow-2xl`} onClick={e => e.stopPropagation()}>
              <h3 id="batch-summary-title" className="text-lg font-bold mb-2 text-red-500">{t('batchSummaryTitle')}</h3>
              <p className={`text-sm mb-4 ${themeClasses.textSemiMuted}`}>{t('batchSummaryMsg').replace('{{count}}', batchSummary.failed.length.toString())}</p>
              
              <div className="bg-black/20 p-4 rounded-lg overflow-auto max-h-60 mb-6">
                <ul className="space-y-4">
                  {batchSummary.failed.map(id => {
                    const item = items.find(i => i.id === id);
                    if (!item) return null;
                    return (
                      <li key={id} className="flex flex-col gap-1 border-b border-white/5 pb-3 last:border-0 last:pb-0">
                         <button onClick={() => { setActiveItemId(id); setBatchSummary({show: false, failed: []}); }} className="flex justify-between items-center w-full text-left font-semibold text-xs hover:text-emerald-400 group transition-colors">
                            <span>{item.file.name}</span>
                            <span className="text-[9px] uppercase tracking-widest opacity-0 group-hover:opacity-60 transition-opacity">Show Details</span>
                         </button>
                         <span className="font-mono text-[10px] text-red-400 opacity-80 truncate" title={item.error || 'Unknown error code'}>{item.error || 'Unknown error code'}</span>
                         <button onClick={() => setFailedItemDetails(item.error || 'Unknown error code')} className={`mt-1 text-[9px] uppercase tracking-widest font-bold self-start opacity-70 hover:opacity-100 hover:text-emerald-400 transition-colors`}>
                           View Stack Trace
                         </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="flex justify-end gap-3">
                <button onClick={() => setBatchSummary({show: false, failed: []})} className={`px-4 py-2 text-sm font-medium rounded-lg border ${themeClasses.borderSecondary} hover:bg-white/5 transition-all duration-200 active:scale-95`} aria-label={t('closeBtn')}>{t('closeBtn')}</button>
                <button onClick={() => { setBatchSummary({show: false, failed: []}); processAll(); }} className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-all duration-200 active:scale-95">
                  {t('retryFailedBtn')}
                </button>
              </div>
            </div>
          </div>
        )}

        {(() => {
          const toProcess = items.filter(i => i.status !== 'idle');
          if (toProcess.length === 0) return null;
          const completed = toProcess.filter(i => i.status === 'completed').length;
          const progress = Math.round((completed / toProcess.length) * 100);
          return (
            <div className={`w-full max-w-xl mx-auto rounded-full overflow-hidden bg-white/10 h-1.5 border ${themeClasses.borderPrimary}`}>
              <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          );
        })()}

        <main className="grid grid-cols-1 lg:grid-cols-4 gap-8">
           {/* Sidebar: Batch List & Settings */}
           <div className="lg:col-span-1 flex flex-col gap-6">
              
              <div className={`p-5 rounded-2xl border ${themeClasses.borderPrimary} ${themeClasses.bgSecondary} flex flex-col gap-4 shadow-sm`}>
                 <div className="flex justify-between items-center">
                   <h3 className={`text-[10px] uppercase tracking-[0.2em] font-bold ${themeClasses.textMuted}`}>{t('batchQueue')}</h3>
                   <Upload className={`w-4 h-4 ${themeClasses.textMuted}`} />
                 </div>
                 
                 <div className="max-h-[300px] overflow-y-auto pr-2 space-y-2">
                    {items.length === 0 && (
                      <div className={`text-xs ${themeClasses.textMuted} italic text-center py-4`}>{t('noItems')}</div>
                    )}
                    {items.map((item, index) => (
                       <div 
                         key={item.id} 
                         onClick={() => setActiveItemId(item.id)}
                         className={`relative flex items-center gap-3 p-2 rounded-xl cursor-pointer border transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] animate-in fade-in slide-in-from-bottom-2 ${activeItemId === item.id ? 'border-emerald-500/50 bg-emerald-500/5' : `${themeClasses.borderSecondary} hover:border-emerald-500/30`}`}
                         style={{ animationDelay: `${Math.min(index * 50, 500)}ms`, animationFillMode: 'both' }}
                       >
                          <img src={item.preview} className="w-10 h-10 object-contain rounded bg-black/10" alt="" />
                          <div className="flex-1 min-w-0">
                             <div className="text-xs truncate font-medium">{item.file.name}</div>
                             <div className={`text-[9px] uppercase tracking-wider mt-1 flex items-center gap-1 ${item.status === 'completed' ? 'text-emerald-500' : item.status === 'failed' ? 'text-red-500' : item.status === 'processing' ? 'text-amber-500' : themeClasses.textMuted}`}>
                               {item.status === 'processing' && <Loader2 className="w-2 h-2 animate-spin" />}
                               {item.status === 'failed' ? (
                                 <button onClick={(e) => { e.stopPropagation(); setFailedItemDetails(item.error || 'Unknown error'); }} className="underline decoration-red-500/50 hover:text-red-400 capitalize truncate max-w-[120px]" title={item.error}>
                                   {item.error || t('statusfailed')}
                                 </button>
                               ) : item.status === 'processing' ? (
                                 item.progressStage <= 1 ? t('statusprocessing') : item.progressStage === 2 ? t('statusvalidating') : item.progressStage === 3 ? t('statusrendering') : t('statusconverting')
                               ) : item.status === 'idle' ? t('statusidle') : t('statuscompleted')}
                             </div>
                          </div>
                          
                          {item.status === 'failed' && (
                             <button onClick={(e) => { e.stopPropagation(); processItem(item.id); }} className={`p-1.5 opacity-50 hover:opacity-100 hover:text-emerald-500 ${themeClasses.hoverBg} rounded-lg transition-all duration-200 active:scale-90`} title={t('retryItemBtn')} aria-label={t('retryItemBtn')}>
                                <RefreshCw className="w-3.5 h-3.5" />
                             </button>
                          )}
                          
                          {item.status === 'completed' && (
                             <button onClick={(e) => { e.stopPropagation(); downloadItemZip(item); }} className={`p-1.5 opacity-50 hover:opacity-100 hover:text-blue-500 ${themeClasses.hoverBg} rounded-lg transition-all duration-200 active:scale-90`} title={t('downloadItemZip')} aria-label={t('downloadItemZip')}>
                                <Archive className="w-3 h-3" />
                             </button>
                          )}
                          
                          <button onClick={(e) => { e.stopPropagation(); removeItem(item.id); }} className={`p-1.5 opacity-50 hover:opacity-100 hover:text-red-500 ${themeClasses.hoverBg} rounded-lg transition-all duration-200 active:scale-90`} title={t('removeItem')} aria-label={t('removeItem')}>
                             <Trash2 className="w-3 h-3" />
                          </button>
                       </div>
                    ))}
                 </div>
                 
                 <div 
                    className={`mt-2 py-3 border border-dashed ${themeClasses.borderSecondary} bg-${isDark ? 'white/[0.02]' : 'black/[0.01]'} rounded-xl flex items-center justify-center text-center cursor-pointer ${isDark ? 'hover:border-white/40' : 'hover:border-black/40'} ${themeClasses.hoverBg} transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]`}
                    onClick={() => document.getElementById('file-upload-batch')?.click()}
                  >
                    <input id="file-upload-batch" type="file" multiple accept="image/png, image/jpeg, image/webp" className="hidden" onChange={handleFileChange} />
                    <span className="text-xs font-semibold uppercase tracking-widest">+ Add Images</span>
                 </div>
              </div>

               <div className={`p-5 rounded-2xl border ${themeClasses.borderPrimary} ${themeClasses.bgSecondary} flex flex-col gap-5 shadow-sm`}>
                 <div className="flex justify-between items-center">
                   <h3 className={`text-[10px] uppercase tracking-[0.2em] font-bold ${themeClasses.textMuted}`}>{t('globalConfig')}</h3>
                   <Settings className={`w-4 h-4 ${themeClasses.textMuted}`} />
                 </div>
                 
                 <div className="space-y-4">
                    {!user ? (
                      <button onClick={handleGoogleLogin} className="w-full flex justify-center items-center gap-2 py-2 text-xs font-semibold rounded-lg bg-[#4285F4] text-white hover:bg-[#3367D6] transition-all duration-200 active:scale-95">
                        <Globe className="w-4 h-4" /> {t('signInGoogle')}
                      </button>
                    ) : (
                      <div className="w-full py-2 px-3 flex items-center justify-center gap-3 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 truncate">
                        <img src={user.picture || `https://api.dicebear.com/7.x/shapes/svg?seed=${user.name}`} alt={user.name} className="w-6 h-6 rounded-full bg-black/20" referrerPolicy="no-referrer" />
                        <span>{t('signedInAs')}: {user.name}</span>
                      </div>
                    )}

                    <div className="space-y-3 relative w-full" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsModelSelectOpen(false); }}>
                       <span className={`text-[10px] uppercase font-bold tracking-widest ${themeClasses.textMuted}`}>{t('aiModel')}</span>
                       
                       <div className="relative">
                         <button 
                           type="button"
                           onClick={() => setIsModelSelectOpen(!isModelSelectOpen)}
                           className={`w-full p-3 text-xs rounded-lg border ${themeClasses.borderSecondary} bg-transparent outline-none transition-all duration-200 hover:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/50 flex items-center justify-between group`}
                         >
                           <div className="flex items-center gap-2">
                             <span className={`w-2 h-2 rounded-full ${selectedModel.status === 'available' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                             <span className="font-semibold">{selectedModel.name}</span>
                             {isModelChanging && <span className="w-3 h-3 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin ml-2" />}
                           </div>
                           <ChevronDown className={`w-4 h-4 opacity-50 transition-transform duration-200 ${isModelSelectOpen ? 'rotate-180' : ''}`} />
                         </button>

                         {isModelSelectOpen && (
                           <div className={`absolute z-[100] top-full left-0 right-0 mt-2 p-1 rounded-xl border ${themeClasses.borderPrimary} bg-[#141414] dark:bg-[#0A0A0A] shadow-2xl animate-in fade-in zoom-in-95 duration-200`}>
                             {AI_MODELS.map(m => (
                               <button
                                 key={m.id}
                                 type="button"
                                 onClick={() => {
                                   setIsModelSelectOpen(false);
                                   if (m.id !== model) {
                                     setIsModelChanging(true);
                                     setModel(m.id);
                                     setTimeout(() => setIsModelChanging(false), 800);
                                   }
                                 }}
                                 className={`w-full text-left p-2.5 rounded-lg transition-all duration-200 flex items-center gap-3 ${model === m.id ? 'bg-emerald-500/10 text-emerald-400' : 'hover:bg-white/5 text-white/80'} group/option relative`}
                               >
                                 <span className={`w-2 h-2 rounded-full shrink-0 ${m.status === 'available' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                 <div className="flex flex-col gap-0.5">
                                   <span className="text-xs font-semibold">{m.name}</span>
                                 </div>
                                 
                                 <div className="hidden group-hover/option:block absolute left-full top-0 ml-2 w-64 p-4 rounded-xl border border-emerald-500/30 bg-[#141414] shadow-2xl z-[110] animate-in fade-in zoom-in-95 duration-100">
                                   <div className="font-bold text-emerald-400 mb-1 flex items-center justify-between">
                                     {m.name}
                                     <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase tracking-widest ${m.status === 'available' ? 'bg-emerald-500/20' : 'bg-red-500/20 text-red-400'}`}>{m.status}</span>
                                   </div>
                                   <div className="text-[10px] text-white/70 mb-3 leading-relaxed">{m.desc}</div>
                                   <div className="space-y-1.5 text-[9px]">
                                     <div className="flex items-center justify-between"><span className="opacity-50">Quality:</span><span className="font-semibold text-emerald-500">{m.quality}</span></div>
                                     <div className="flex items-center justify-between"><span className="opacity-50">Est. Time:</span><span className="font-mono">{m.estTime}</span></div>
                                     <div className="border-t border-white/10 mt-2.5 pt-2.5">
                                       <span className="block opacity-50 mb-1">Use Case:</span>
                                       <span className="text-white/80 leading-relaxed block">{m.suitability}</span>
                                     </div>
                                   </div>
                                 </div>
                               </button>
                             ))}
                           </div>
                         )}
                       </div>

                       <div className={`mt-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] relative overflow-hidden group`}>
                         <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50" />
                         <h4 className="text-xs font-bold text-emerald-400 mb-1.5 flex items-center gap-2">
                            {selectedModel.name}
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-md uppercase tracking-widest ${selectedModel.status === 'available' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                              {selectedModel.status}
                            </span>
                         </h4>
                         <p className={`text-[10px] leading-relaxed mb-3 text-white/70`}>
                           {selectedModel.desc}
                         </p>
                         <div className={`grid grid-cols-2 gap-3 text-[10px] border-t border-emerald-500/10 pt-3 relative`}>
                           <div>
                             <span className={`block opacity-50 uppercase tracking-widest mb-1 text-[9px]`}>{t('estTime')}</span>
                             <span className="font-mono font-medium">{selectedModel.estTime}</span>
                           </div>
                           <div>
                             <span className={`block opacity-50 uppercase tracking-widest mb-1 text-[9px]`}>{t('typQuality')}</span>
                             <span className="font-semibold">{selectedModel.quality}</span>
                           </div>
                           <div className="col-span-2">
                             <span className={`block opacity-50 uppercase tracking-widest mb-1 text-[9px]`}>{t('modelSuitability', 'Suitability')}</span>
                             <span className={`block leading-relaxed text-white/80`}>
                               {selectedModel.suitability}
                             </span>
                           </div>
                         </div>
                       </div>
                    </div>

                    <label className={`block space-y-1.5`}>
                       <span className={`text-[10px] uppercase font-bold tracking-widest ${themeClasses.textMuted}`}>{t('renderQuality')}</span>
                       <select value={quality} onChange={e => setQuality(e.target.value)} className={`w-full p-2 text-xs rounded-lg border ${themeClasses.borderSecondary} bg-transparent outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/50 focus:border-transparent cursor-pointer`}>
                         <option value="high">High Fidelity (Most Details)</option>
                         <option value="optimized">Optimized (Balanced)</option>
                         <option value="minimal">Minimal (Flat vectors)</option>
                       </select>
                    </label>

                    <hr className={themeClasses.borderSecondary} />

                    <div className="flex flex-col space-y-4">
                      <label className={`flex items-start space-x-3 cursor-pointer ${themeClasses.textSemiMuted} hover:opacity-100 transition-all duration-200`}>
                        <input type="checkbox" checked={simplifyPaths} onChange={(e) => setSimplifyPaths(e.target.checked)} className={`mt-0.5 form-checkbox h-3.5 w-3.5 rounded border-${isDark ? 'white/20' : 'black/20'} text-emerald-500 bg-transparent transition-all duration-200 focus:ring-2 focus:ring-emerald-500/50 cursor-pointer`} />
                        <div className="flex flex-col gap-0.5">
                           <span className="text-[11px] font-semibold">{t('simplifyLabel')}</span>
                           <span className={`text-[9px] ${themeClasses.textMuted} leading-tight`}>{t('simplifyDesc')}</span>
                        </div>
                      </label>
                      <label className={`flex items-start space-x-3 cursor-pointer ${themeClasses.textSemiMuted} hover:opacity-100 transition-all duration-200`}>
                        <input type="checkbox" checked={removeMetadata} onChange={(e) => setRemoveMetadata(e.target.checked)} className={`mt-0.5 form-checkbox h-3.5 w-3.5 rounded border-${isDark ? 'white/20' : 'black/20'} text-emerald-500 bg-transparent transition-all duration-200 focus:ring-2 focus:ring-emerald-500/50 cursor-pointer`} />
                        <div className="flex flex-col gap-0.5">
                           <span className="text-[11px] font-semibold">{t('removeMetadataLabel')}</span>
                           <span className={`text-[9px] ${themeClasses.textMuted} leading-tight`}>{t('removeMetadataDesc')}</span>
                        </div>
                      </label>
                      
                      <div className="pt-2">
                        <button 
                          onClick={() => setAdvancedSVGO(!advancedSVGO)}
                          aria-expanded={advancedSVGO}
                          aria-controls="advanced-svgo-panel"
                          className={`w-full flex items-center justify-between p-2 rounded border border-dashed ${themeClasses.borderSecondary} hover:bg-white/5 transition-all duration-200 text-[10px] uppercase font-bold tracking-widest ${themeClasses.textMuted}`}
                        >
                          {t('advancedOptions')}
                          <span className="text-xs" aria-hidden="true">{advancedSVGO ? '-' : '+'}</span>
                        </button>
                        
                        {advancedSVGO && (
                          <div id="advanced-svgo-panel" className={`mt-3 p-3 rounded-lg border ${themeClasses.borderPrimary} bg-black/5 dark:bg-white/[0.02] space-y-4`}>
                            <label className={`flex items-start space-x-3 cursor-pointer ${themeClasses.textSemiMuted} hover:opacity-100 transition-all duration-200`}>
                              <input type="checkbox" aria-label={t('pathFittingLabel')} title={t('pathFittingDesc')} checked={pathFitting} onChange={(e) => setPathFitting(e.target.checked)} className={`mt-0.5 form-checkbox h-3.5 w-3.5 rounded border-${isDark ? 'white/20' : 'black/20'} text-emerald-500 bg-transparent transition-all duration-200 focus:ring-2 focus:ring-emerald-500/50 cursor-pointer`} />
                              <div className="flex flex-col gap-0.5">
                                 <span className="text-[11px] font-semibold">{t('pathFittingLabel')}</span>
                                 <span className={`text-[9px] ${themeClasses.textMuted} leading-tight`}>{t('pathFittingDesc')}</span>
                              </div>
                            </label>
                            <label className={`flex items-start space-x-3 cursor-pointer ${themeClasses.textSemiMuted} hover:opacity-100 transition-all duration-200`}>
                              <input type="checkbox" aria-label={t('strokeOptLabel')} title={t('strokeOptDesc')} checked={strokeOpt} onChange={(e) => setStrokeOpt(e.target.checked)} className={`mt-0.5 form-checkbox h-3.5 w-3.5 rounded border-${isDark ? 'white/20' : 'black/20'} text-emerald-500 bg-transparent transition-all duration-200 focus:ring-2 focus:ring-emerald-500/50 cursor-pointer`} />
                              <div className="flex flex-col gap-0.5">
                                 <span className="text-[11px] font-semibold">{t('strokeOptLabel')}</span>
                                 <span className={`text-[9px] ${themeClasses.textMuted} leading-tight`}>{t('strokeOptDesc')}</span>
                              </div>
                            </label>
                            <label className={`flex items-start space-x-3 cursor-pointer ${themeClasses.textSemiMuted} hover:opacity-100 transition-all duration-200`}>
                              <input type="checkbox" aria-label={t('colorQuantLabel')} title={t('colorQuantDesc')} checked={colorQuant} onChange={(e) => setColorQuant(e.target.checked)} className={`mt-0.5 form-checkbox h-3.5 w-3.5 rounded border-${isDark ? 'white/20' : 'black/20'} text-emerald-500 bg-transparent transition-all duration-200 focus:ring-2 focus:ring-emerald-500/50 cursor-pointer`} />
                              <div className="flex flex-col gap-0.5">
                                 <span className="text-[11px] font-semibold">{t('colorQuantLabel')}</span>
                                 <span className={`text-[9px] ${themeClasses.textMuted} leading-tight`}>{t('colorQuantDesc')}</span>
                              </div>
                            </label>
                          </div>
                        )}
                        
                        <div className="mt-4 border-t border-dashed border-white/20 pt-4">
                           <span className={`block opacity-60 uppercase font-bold tracking-wider mb-2 text-[10px]`}>{t('exportSettingsTitle')}</span>
                           <div className="grid grid-cols-2 gap-3 mb-3">
                              <div title={t('exportWidthTooltip')}>
                                 <label className="text-[9px] opacity-60 uppercase tracking-widest font-bold block mb-1 cursor-help">{t('exportWidth')}</label>
                                 <input type="number" min="10" max="10000" value={customWidth} onChange={(e) => setCustomWidth(parseInt(e.target.value) || 0)} className={`w-full p-2 text-xs rounded-lg border ${themeClasses.borderSecondary} bg-transparent outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/50`} />
                              </div>
                              <div title={t('exportHeightTooltip')}>
                                 <label className="text-[9px] opacity-60 uppercase tracking-widest font-bold block mb-1 cursor-help">{t('exportHeight')}</label>
                                 <input type="number" min="10" max="10000" value={customHeight} onChange={(e) => setCustomHeight(parseInt(e.target.value) || 0)} className={`w-full p-2 text-xs rounded-lg border ${themeClasses.borderSecondary} bg-transparent outline-none transition-all duration-200 focus:ring-2 focus:ring-emerald-500/50`} />
                              </div>
                           </div>
                           <div title={t('exportStrokeTooltip')}>
                              <label className="flex items-center justify-between text-[9px] opacity-60 uppercase tracking-widest font-bold mb-1 cursor-help">
                                <span>{t('exportStrokeWidth')}</span>
                                <span>{strokeWidth}px</span>
                              </label>
                              <input type="range" min="0" max="20" step="0.5" value={strokeWidth} onChange={(e) => setStrokeWidth(parseFloat(e.target.value))} className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-white/20 accent-emerald-500" />
                              <span className="text-[9px] block text-emerald-500 mt-1 opacity-70">{t('exportStrokeDesc')}</span>
                           </div>
                           {activeItemId && items.find(i => i.id === activeItemId)?.status === 'completed' && (
                              <button onClick={() => applyExportSettings(activeItemId)} className={`mt-3 w-full p-2 text-[10px] uppercase tracking-widest font-bold rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all duration-200 active:scale-95`}>
                                Apply Settings
                              </button>
                           )}
                        </div>
                      </div>
                    </div>
                 </div>
              </div>

           </div>

           {/* Main Display: Active Item */}
           <div className={`lg:col-span-3 ${themeClasses.bgSecondary} rounded-2xl border ${themeClasses.borderPrimary} p-6 md:p-8 flex flex-col transition-colors duration-300 shadow-sm relative min-h-[500px]`}>
              {!activeItem ? (
                 <div className="flex flex-col items-center justify-center h-full opacity-60 my-auto">
                    <img src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop" alt="Empty State Graphic" className="w-48 h-48 object-cover rounded-3xl mb-8 opacity-40 grayscale mix-blend-overlay pointer-events-none" referrerPolicy="no-referrer" />
                    <span className="text-sm font-bold uppercase tracking-[0.2em] font-mono text-center max-w-sm">Select or Upload an Image</span>
                    <p className={`text-xs mt-3 text-center max-w-xs ${themeClasses.textMuted}`}>Drop a raster logo anywhere to start its AI vectorization process.</p>
                 </div>
              ) : (
                 <div className="flex flex-col h-full gap-6">
                    {/* Toolbar for Active Item */}
                    <div className="flex justify-between items-center">
                       <h2 className="text-sm font-semibold tracking-wide flex items-center gap-3">
                          <span className="truncate max-w-[200px] sm:max-w-sm">{activeItem.file.name}</span>
                          {activeItem.status === 'processing' && <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />}
                       </h2>
                       
                       <div className="flex gap-2">
                          <button onClick={() => processItem(activeItem.id)} disabled={activeItem.status === 'processing'} className={`p-2 rounded-lg border ${themeClasses.borderSecondary} hover:bg-emerald-500/10 hover:text-emerald-500 transition-all duration-200 active:scale-90 disabled:opacity-30`} title="Process / Regenerate" aria-label="Process / Regenerate">
                             <Zap className="w-4 h-4" />
                          </button>
                          
                          {activeItem.status === 'completed' && activeItem.history.length > 1 && (
                             <>
                                <button onClick={() => handleUndo(activeItem.id)} disabled={activeItem.historyIndex <= 0} className={`p-2 rounded-lg border ${themeClasses.borderSecondary} ${themeClasses.hoverBg} transition-all duration-200 active:scale-90 disabled:opacity-30`} title="Undo Modification" aria-label="Undo Edit">
                                   <Undo className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleRedo(activeItem.id)} disabled={activeItem.historyIndex >= activeItem.history.length - 1} className={`p-2 rounded-lg border ${themeClasses.borderSecondary} ${themeClasses.hoverBg} transition-all duration-200 active:scale-90 disabled:opacity-30`} title="Redo Modification" aria-label="Redo Edit">
                                   <Redo className="w-4 h-4" />
                                </button>
                             </>
                          )}
                          
                          {activeItem.status === 'completed' && (
                             <>
                               {previewSvgStr ? (
                                 <button onClick={() => handleApplyPreview(activeItem.id)} disabled={activeItem.status === 'processing' || isPreviewLoading} className={`text-[10px] uppercase tracking-widest px-4 py-2 font-bold rounded-lg border ${themeClasses.borderSecondary} bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all duration-200 active:scale-95 disabled:opacity-50`} title={t('applyLivePreviewTitle')}>
                                    {isPreviewLoading ? t('loadingPreview') : t('applyPreview')}
                                 </button>
                               ) : (
                                 <button disabled className={`text-[10px] uppercase tracking-widest px-4 py-2 font-bold rounded-lg border ${themeClasses.borderSecondary} bg-gray-500/10 text-gray-400 opacity-50`} title={t('makeChangesToPreviewTitle')}>
                                    {t('upToDate')}
                                 </button>
                               )}
                               {activeItem.pngBase64 && (
                                 <a href={`data:image/png;base64,${activeItem.pngBase64}`} download={`${activeItem.file.name.replace(/\.[^/.]+$/, "")}.png`} className={`p-2 flex items-center justify-center gap-2 rounded-lg border ${themeClasses.borderSecondary} ${themeClasses.hoverBg} transition-all duration-200 active:scale-90 font-bold text-[10px]`} title={t('downloadPngBtn')} aria-label={t('downloadPngBtn')}>
                                    <Download className="w-4 h-4" /> {t('downloadPngBtn')}
                                 </a>
                               )}
                               {activeItem.svgBase64 && (
                                 <button onClick={() => downloadIndividualSvg(activeItem)} className={`p-2 flex items-center justify-center gap-2 rounded-lg border ${themeClasses.borderSecondary} ${themeClasses.hoverBg} transition-all duration-200 active:scale-90 font-bold text-[10px]`} title={t('downloadSvgBtn')} aria-label={t('downloadSvgBtn')}>
                                    <Download className="w-4 h-4" /> {t('downloadSvgBtn')}
                                 </button>
                               )}
                             </>
                          )}
                       </div>
                    </div>

                    {activeItem.error && (
                       <div className={`p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 flex items-center gap-3 text-xs`}>
                          <AlertCircle className="w-4 h-4" /> {activeItem.error}
                       </div>
                    )}

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 relative items-center">
                       {/* Source Box */}
                       <div className="flex flex-col items-center justify-center gap-4 h-full relative">
                          <img src={activeItem.preview} alt="Original" className="max-h-[300px] object-contain rounded-xl opacity-90" />
                          <span className={`text-[10px] uppercase font-bold tracking-widest ${themeClasses.textMuted} absolute bottom-0`}>Original Image</span>
                       </div>
                       
                       {/* Result Box */}
                       <div className={`flex flex-col justify-center items-center h-full relative rounded-xl border ${themeClasses.borderPrimary} overflow-hidden`} style={{
                          backgroundImage: themeClasses.gridColor,
                          backgroundSize: '24px 24px',
                          backgroundColor: isDark ? '#080808' : '#fafafa'
                       }}>
                          {activeItem.status === 'processing' ? (
                             <div className="flex flex-col items-center justify-center gap-6 z-10 bg-black/40 backdrop-blur-md absolute inset-0 text-white transition-opacity duration-300">
                                <Loader2 className="w-8 h-8 animate-spin text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                                <div className="text-xs uppercase tracking-widest font-mono text-emerald-400 animate-pulse">
                                   {progressStages[activeItem.progressStage]}
                                </div>
                             </div>
                          ) : activeItem.status === 'completed' && activeItem.svgBase64 ? (
                             <div className="w-full h-full flex items-center justify-center relative overflow-hidden" 
                               onWheel={(e) => {
                                 if (e.ctrlKey || e.metaKey) {
                                    e.preventDefault();
                                    const zoom = e.deltaY < 0 ? 1.1 : 0.9;
                                    setZoomScale(s => Math.min(Math.max(s * zoom, 0.1), 10));
                                 }
                               }}
                               onPointerDown={(e) => {
                                 if (e.button === 1 || e.shiftKey) {
                                   setIsPanning(true);
                                   e.currentTarget.setPointerCapture(e.pointerId);
                                 }
                               }}
                               onPointerMove={(e) => {
                                 if (isPanning) {
                                   setPanX(x => x + e.movementX);
                                   setPanY(y => y + e.movementY);
                                 } else if (dragPart) {
                                   const newRealX = dragPart.realX + e.movementX / Math.max(zoomScale, 0.1);
                                   const newRealY = dragPart.realY + e.movementY / Math.max(zoomScale, 0.1);
                                   
                                   // Snap to 10px increments if freeform dragging (holding shift) is NOT active
                                   let snapTx = newRealX;
                                   let snapTy = newRealY;
                                   
                                   if (!e.shiftKey) {
                                      snapTx = Math.round(newRealX / 10) * 10;
                                      snapTy = Math.round(newRealY / 10) * 10;
                                   }

                                   setDragPart({ ...dragPart, realX: newRealX, realY: newRealY, tx: snapTx, ty: snapTy });
                                 }
                               }}
                               onPointerUp={(e) => {
                                 setIsPanning(false);
                                 if (dragPart) {
                                   try {
                                     const rawSvg = atob(activeItem.svgBase64!);
                                     const parser = new DOMParser();
                                     const doc = parser.parseFromString(rawSvg, "image/svg+xml");
                                     const el = doc.querySelector(`[data-name="${dragPart.name}"]`);
                                     if (el) {
                                       let bz = el.getAttribute('transform') || '';
                                       if(bz.includes('translate(')) {
                                          const regex = /translate\([^)]+\)/;
                                          bz = bz.replace(regex, `translate(${dragPart.tx},${dragPart.ty})`);
                                       } else {
                                          bz = `${bz} translate(${dragPart.tx},${dragPart.ty})`;
                                       }
                                       el.setAttribute('transform', bz);
                                       const ser = new XMLSerializer();
                                       // @ts-ignore
                                       updateItemSuccess(activeItem.id, activeItem.pngBase64 || '', btoa(ser.serializeToString(doc)));
                                     }
                                   } catch(err) {}
                                   setDragPart(null);
                                 }
                                 e.currentTarget.releasePointerCapture(e.pointerId);
                               }}
                             >
                               <div className="absolute top-4 right-4 flex flex-col gap-2 z-20">
                                 <div className="flex gap-2">
                                   <button onClick={() => setZoomScale(s => Math.min(s * 1.2, 10))} className={`p-1.5 rounded-lg border ${themeClasses.borderSecondary} bg-black/20 hover:bg-black/40 text-white backdrop-blur transition-all active:scale-95`} title="Zoom In"><ZoomIn className="w-4 h-4" /></button>
                                   <button onClick={() => setZoomScale(s => Math.max(s / 1.2, 0.1))} className={`p-1.5 rounded-lg border ${themeClasses.borderSecondary} bg-black/20 hover:bg-black/40 text-white backdrop-blur transition-all active:scale-95`} title="Zoom Out"><ZoomOut className="w-4 h-4" /></button>
                                   <button onClick={() => { setZoomScale(1); setPanX(0); setPanY(0); }} className={`p-1.5 rounded-lg border ${themeClasses.borderSecondary} bg-black/20 hover:bg-black/40 text-white backdrop-blur transition-all active:scale-95`} title="Fit Screen"><Maximize className="w-4 h-4" /></button>
                                 </div>
                                 <div className="flex justify-end pr-1 gap-3 items-center">
                                   <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400">PAN {Math.round(panX)},{Math.round(panY)}</span>
                                   <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400">ZOOM {Math.round(zoomScale * 100)}%</span>
                                 </div>
                               </div>
                               
                               <div className="absolute bottom-4 right-4 w-32 h-32 bg-[#141414]/90 dark:bg-[#0A0A0A]/90 border border-emerald-500/20 rounded-xl overflow-hidden backdrop-blur-md hidden sm:block z-20 shadow-2xl">
                                  <div className="w-full h-full relative" style={{ padding: '8px' }}>
                                     <img src={`data:image/svg+xml;base64,${activeItem.svgBase64}`} alt="Minimap" className="w-full h-full object-contain opacity-50 filter grayscale" />
                                     <div 
                                       className="absolute border border-emerald-500 bg-emerald-500/10 pointer-events-none transition-all duration-75"
                                       style={{
                                          width: `${Math.min(100, 100 / zoomScale)}%`,
                                          height: `${Math.min(100, 100 / zoomScale)}%`,
                                          top: `${Math.max(0, Math.min(100 - (100 / zoomScale), 50 - (panY / (500 * Math.max(zoomScale, 1))) * 50 - (50 / zoomScale)))}%`,
                                          left: `${Math.max(0, Math.min(100 - (100 / zoomScale), 50 - (panX / (500 * Math.max(zoomScale, 1))) * 50 - (50 / zoomScale)))}%`,
                                       }}
                                     />
                                  </div>
                               </div>

                               {dragPart && (
                                  <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `linear-gradient(to right, rgba(16, 185, 129, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(16, 185, 129, 0.1) 1px, transparent 1px)`, backgroundSize: `${10 * zoomScale}px ${10 * zoomScale}px`, backgroundPosition: `${panX + 250}px ${panY + 250}px` }} />
                               )}

                               <div 
                                 className="svg-container w-full h-full flex items-center justify-center p-8 origin-center cursor-grab active:cursor-grabbing"
                                 style={{ transform: `translate(${panX}px, ${panY}px) scale(${zoomScale})`, transition: isPanning ? 'none' : 'transform 0.1s ease-out' }}
                                 onClick={(e) => {
                                   if (isPanning || dragPart || e.shiftKey) return;
                                   const target = e.target as SVGElement;
                                   const name = target.getAttribute('data-name') || target.closest('[data-name]')?.getAttribute('data-name');
                                 if (name) {
                                   const legendItem = legendItems.find(i => i.name === name);
                                   if (legendItem) {
                                     setSelectedPart(legendItem);
                                     setPartFillColor(legendItem.props.fill || legendItem.props.stroke || '#000000');
                                   }
                                 }
                               }}
                               onMouseMove={(e) => {
                                 const target = e.target as SVGElement;
                                 const name = target.getAttribute('data-name') || target.closest('[data-name]')?.getAttribute('data-name');
                                 if (name && hoveredLegend?.name !== name) {
                                   const legendItem = legendItems.find(i => i.name === name);
                                   if (legendItem) setHoveredLegend(legendItem);
                                 } else if (!name && hoveredLegend) {
                                   setHoveredLegend(null);
                                 }
                               }}
                                 onMouseLeave={() => setHoveredLegend(null)}
                                 onMouseDown={(e) => {
                                   if (!e.shiftKey && e.button !== 1) {
                                     const target = e.target as SVGElement;
                                     const name = target.getAttribute('data-name') || target.closest('[data-name]')?.getAttribute('data-name');
                                     if (name) {
                                        setDragPart({ name, ox: e.clientX, oy: e.clientY, tx: 0, ty: 0, realX: 0, realY: 0 });
                                     }
                                   }
                                 }}
                                 dangerouslySetInnerHTML={{ __html: dragPart ? (interactiveSvgHtml || '').replace(new RegExp(`data-name="${dragPart.name}"(.*?transform="[^"]*")?`), (match) => {
                                     if(match.includes('transform="')) return match.split('transform="')[0] + `transform="${match.split('transform="')[1].split('"')[0]} translate(${dragPart.tx},${dragPart.ty})"` + match.substring(match.indexOf('"', match.indexOf('transform="') + 11) + 1);
                                    return `data-name="${dragPart.name}" transform="translate(${dragPart.tx},${dragPart.ty})"`;
                                 }) : interactiveSvgHtml || '' }} 
                               />
                             </div>
                          ) : (
                             <div className="flex flex-col items-center justify-center space-y-6 opacity-60">
                                <div className="relative">
                                  <div className={`absolute -inset-4 rounded-full border border-emerald-500/20 blur-sm animate-pulse`}></div>
                                  <div className={`absolute -inset-1 rounded-full border border-emerald-500/40 animate-ping`}></div>
                                  <div className={`w-20 h-20 rounded-2xl border border-emerald-500/50 flex items-center justify-center bg-gradient-to-br from-emerald-500/10 to-transparent backdrop-blur-md relative z-10 ${themeClasses.shadow}`}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-500 opacity-80" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                                    </svg>
                                  </div>
                                </div>
                                <span className={`text-[10px] uppercase tracking-[0.3em] font-medium text-emerald-500`}>Awaiting Render</span>
                             </div>
                          )}
                          <span className={`text-[10px] uppercase font-bold tracking-widest opacity-40 absolute bottom-4 bg-[#0A0A0A] px-2 py-1 rounded drop-shadow-lg text-white`}>Vector Rendering</span>
                       </div>
                    </div>
                    
                    
                    {/* SVG Validation Errors */}
                    {validationErrors && validationErrors.length > 0 && (
                      <details className={`mt-4 group rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden transition-all duration-300`}>
                        <summary className="flex items-center gap-3 p-4 cursor-pointer select-none outline-none">
                           <AlertCircle className="w-5 h-5 text-amber-500" />
                           <span className="text-xs font-bold uppercase tracking-wider text-amber-500">{t('validationWarning')}</span>
                           <span className="ml-auto text-xs bg-amber-500/20 text-amber-500 px-2.5 py-0.5 rounded-full font-bold">{validationErrors.length}</span>
                        </summary>
                        <div className="p-4 pt-0 border-t border-amber-500/20 bg-black/5 dark:bg-black/20">
                           <ul className="space-y-3 mt-3">
                             {validationErrors.map((err, i) => (
                               <li key={i} className="text-xs font-mono text-amber-600 dark:text-amber-400 flex items-start gap-3">
                                 <span className="opacity-60 bg-amber-500/10 px-1.5 py-0.5 rounded mt-0.5">Line {err.line}</span> 
                                 <span className="mt-1 leading-relaxed">{err.desc}</span>
                               </li>
                             ))}
                           </ul>
                        </div>
                      </details>
                    )}

                    {/* Interactive Legend Row */}
                    {activeItem.status === 'completed' && legendItems.length > 0 && (
                       <div className={`mt-4 pt-4 border-t ${themeClasses.borderPrimary} flex flex-col gap-3 relative pb-8`}>
                          <LayerEditor svgBase64={activeItem.svgBase64 || ''} itemId={activeItem.id} onUpdate={updateItemSuccess} isDark={isDark} />
                          <h4 className="text-[10px] uppercase font-bold tracking-[0.2em] opacity-60 flex items-center gap-2 mt-4">
                             <List className="w-3 h-3" /> Semantic Parts Detected
                          </h4>
                          <div className="flex flex-wrap gap-2">
                             {legendItems.map(item => (
                                <div key={item.name} className="relative group/legend">
                                  <button
                                     onMouseEnter={() => setHoveredLegend(item)}
                                     onMouseLeave={() => setHoveredLegend(null)}
                                     onClick={() => {
                                        setSelectedPart(item);
                                        setPartFillColor(item.props.fill || item.props.stroke || '#000000');
                                     }}
                                     className={`text-[10px] font-mono px-3 py-1.5 rounded-full border transition-all duration-200 active:scale-95 cursor-crosshair
                                        ${(hoveredLegend?.name === item.name || selectedPart?.name === item.name) ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : `${themeClasses.borderSecondary} text-white/60 hover:border-white/40`}
                                     `}
                                  >
                                     {item.name}
                                  </button>
                                  {hoveredLegend?.name === item.name && selectedPart?.name !== item.name && (
                                    <div className="absolute z-50 top-full mt-2 left-1/2 -translate-x-1/2 w-max max-w-[220px] p-4 rounded-xl bg-[#141414] dark:bg-[#0A0A0A] border border-emerald-500/30 shadow-2xl pointer-events-none animate-in fade-in slide-in-from-top-1 duration-200">
                                      <div className="text-emerald-400 font-bold text-[11px] uppercase tracking-widest mb-2 border-b border-emerald-500/20 pb-2">{item.name}</div>
                                      <div className="flex flex-col gap-1.5 text-[10px] font-mono text-white/80">
                                        {Object.entries(item.props).map(([k,v]) => (
                                          <div key={k} className="flex justify-between gap-6">
                                            <span className="opacity-50">{k}:</span>
                                            <span className="truncate ml-auto font-semibold">{v}</span>
                                          </div>
                                        ))}
                                        {Object.keys(item.props).length === 0 && <span className="opacity-50 italic">No attributes tracked</span>}
                                      </div>
                                    </div>
                                  )}
                                </div>
                             ))}
                          </div>
                          <span className="text-[9px] opacity-40 font-mono">{t('legendAssist')}</span>
                          
                          {selectedPart && (
                            <div className={`mt-2 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex flex-col sm:flex-row sm:items-center gap-4`}>
                               <div className="flex flex-col gap-1 flex-1">
                                 <span className="text-emerald-500 font-bold text-[11px] uppercase tracking-widest">{selectedPart.name}</span>
                                 <span className="text-[9px] opacity-60 uppercase font-mono">{t('adjustFillStroke')}</span>
                               </div>
                               <input type="color" value={partFillColor} onChange={e => setPartFillColor(e.target.value)} className="w-8 h-8 rounded border-none bg-transparent cursor-pointer outline-none" />
                               <div className="flex gap-2">
                                  <button onClick={() => setSelectedPart(null)} className={`px-3 py-1.5 text-[10px] uppercase font-bold rounded-lg border ${themeClasses.borderSecondary} hover:bg-white/5 transition-all duration-200 active:scale-95`}>{t('cancelBtn')}</button>
                                  <button onClick={() => { updateSvgElementColor(activeItem.id, selectedPart.name, partFillColor); setSelectedPart(null); }} className="px-3 py-1.5 text-[10px] uppercase font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-all duration-200 active:scale-95">{t('applyBtn')}</button>
                               </div>
                            </div>
                          )}
                       </div>
                    )}
                 </div>
              )}
           </div>
        </main>
        
        {/* Footer / Locale Switcher */}
        <footer className={`w-full py-8 mt-12 flex justify-center items-center gap-6 border-t ${themeClasses.borderPrimary}`}>
          <div className="flex gap-4">
            <button onClick={() => i18n.changeLanguage('en')} className={`text-xs tracking-wider transition-all duration-200 hover:scale-[1.05] active:scale-95 hover:text-emerald-500 ${i18n.language === 'en' ? 'font-bold text-emerald-500' : themeClasses.textSemiMuted}`}>EN</button>
            <button onClick={() => i18n.changeLanguage('fr')} className={`text-xs tracking-wider transition-all duration-200 hover:scale-[1.05] active:scale-95 hover:text-emerald-500 ${i18n.language === 'fr' ? 'font-bold text-emerald-500' : themeClasses.textSemiMuted}`}>FR</button>
          </div>
          <span className={`text-[10px] tracking-widest uppercase ${themeClasses.textMuted}`}>&copy; 2026</span>
        </footer>
      </div>
    </div>
  );
}
