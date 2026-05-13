const fs = require('fs');

// Patch App.tsx
let appCode = fs.readFileSync('src/App.tsx', 'utf-8');

// Remove ZoomIn/ZoomOut/FitScreen buttons and text
const zoomInIdx = appCode.indexOf('setZoomScale(s => Math.min(s * 1.2, 10))');
if (zoomInIdx !== -1) {
    const startIdx = appCode.lastIndexOf('<div className="absolute top-4 right-4', zoomInIdx);
    const endDiv1 = appCode.indexOf('</div>', zoomInIdx) + 6;
    const endDiv2 = appCode.indexOf('</div>', endDiv1) + 6;
    const endDiv3 = appCode.indexOf('</div>', endDiv2) + 6;
    appCode = appCode.substring(0, startIdx) + appCode.substring(endDiv3);
}

// Add state for hovered/selected layer IDs
if(!appCode.includes('highlightedLayerIds')) {
    appCode = appCode.replace(
        'const [colorQuant, setColorQuant] = useState',
        'const [highlightedLayerIds, setHighlightedLayerIds] = useState<string[]>([]);\n  const [colorQuant, setColorQuant] = useState'
    );
}

// Pass onHighlight to LayerEditor
appCode = appCode.replace(/<LayerEditor svgBase64=\{activeItem\.svgBase64 \|\| ''\} itemId=\{activeItem\.id\} onUpdate=\{updateItemSuccess\} isDark=\{isDark\} \/>/, `<LayerEditor svgBase64={activeItem.svgBase64 || ''} itemId={activeItem.id} onUpdate={(itemId, newSvg) => updateItemSuccess(itemId, activeItem.pngBase64 || '', newSvg)} onHighlight={setHighlightedLayerIds} isDark={isDark} />`);

// Inject hover highlights CSS
const styleToInject = `
                                 {highlightedLayerIds.length > 0 && (
                                   <style>{\`\${highlightedLayerIds.map(id => \`[data-layer-id="\${id}"] { outline: 2px solid #10b981; filter: drop-shadow(0 0 8px #10b981) brightness(1.2); }\`).join(' ')}\`}</style>
                                 )}
                                 `;
// find dangerouslySetInnerHTML
appCode = appCode.replace(/dangerouslySetInnerHTML=\{\{ __html: dragPart \? \(interactiveSvgHtml \|\| ''\)/, styleToInject + 'dangerouslySetInnerHTML={{ __html: dragPart ? (interactiveSvgHtml || \'\')');

fs.writeFileSync('src/App.tsx', appCode);

// Patch LayerEditor.tsx
let layerCode = fs.readFileSync('src/LayerEditor.tsx', 'utf-8');

layerCode = layerCode.replace('onUpdate: (itemId: string, newSvgBase64: string) => void;', 'onUpdate: (itemId: string, newSvgBase64: string) => void;\n  onHighlight?: (ids: string[]) => void;');
layerCode = layerCode.replace('= ({ svgBase64, itemId, onUpdate, isDark })', '= ({ svgBase64, itemId, onUpdate, onHighlight, isDark })');

layerCode = layerCode.replace(
    'const name = child.getAttribute(\'data-name\') || child.tagName;',
    `child.setAttribute('data-layer-id', id);\n          const name = child.getAttribute('data-name') || child.tagName;`
);

layerCode = layerCode.replace(
    /if \(svgRoot\) \{\n\s*setLayers\(buildTree\(svgRoot, 'root'\)\);\n\s*setPendingLayers\(null\);\n\s*\}/,
    `if (svgRoot) {\n        setLayers(buildTree(svgRoot, 'root'));\n        const ser = new XMLSerializer();\n        const newBase64 = btoa(ser.serializeToString(doc));\n        if (newBase64 !== svgBase64) onUpdate(itemId, newBase64);\n        setPendingLayers(null);\n      }`
);

layerCode = layerCode.replace(
    /const \[editName, setEditName\] = useState\(''\);/,
    `const [editName, setEditName] = useState('');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (onHighlight) {
       const highlights = new Set(selectedIds);
       if (hoveredNodeId) highlights.add(hoveredNodeId);
       onHighlight(Array.from(highlights));
    }
  }, [selectedIds, hoveredNodeId, onHighlight]);`
);

// We need to inject onMouseEnter/Leave into the div returning the layer item row
// It looks like: className={\`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors \${isSelected ? 'bg-emerald-500/10 text-emerald-500' : 
layerCode = layerCode.replace(
    /className=\{\`flex items-center gap-2 py-1\.5 px-2 rounded-lg cursor-pointer transition-colors \$\{isSelected \? 'bg-emerald-500\/10 text-emerald-500' : /g,
    `onMouseEnter={() => setHoveredNodeId(node.id)} onMouseLeave={() => setHoveredNodeId(null)} className={\`flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer transition-colors \${isSelected ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : `
);

fs.writeFileSync('src/LayerEditor.tsx', layerCode);
