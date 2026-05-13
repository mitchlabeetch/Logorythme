const fs = require('fs');
let code = fs.readFileSync('src/LayerEditor.tsx', 'utf-8');

if (!code.includes('dragOverTarget')) {
  code = code.replace(
    'const [dragItem, setDragItem] = useState<string | null>(null);',
    'const [dragItem, setDragItem] = useState<string | null>(null);\n  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);\n  const [dragOverPosition, setDragOverPosition] = useState<\'above\' | \'below\' | \'inside\' | null>(null);'
  );
}

// Replace drag events
code = code.replace(
  /onDragOver=\{\(e\) => e\.preventDefault\(\)\}/g,
  `onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (dragItem === node.id || selectedIds.has(node.id)) return;
            const rect = (e.currentTarget as Element).getBoundingClientRect();
            const y = e.clientY - rect.top;
            if (node.type === 'group' && y > rect.height * 0.25 && y < rect.height * 0.75) {
              setDragOverTarget(node.id);
              setDragOverPosition('inside');
            } else if (y < rect.height / 2) {
              setDragOverTarget(node.id);
              setDragOverPosition('above');
            } else {
              setDragOverTarget(node.id);
              setDragOverPosition('below');
            }
          }}
          onDragLeave={() => {
            setDragOverTarget(null);
            setDragOverPosition(null);
          }}`
);

code = code.replace(
  /onDrop=\{\(e\) => \{[\s\S]*?handleDrop\(e, node\.id, 'below'\);\n\s*\}\n\s*\}\}/,
  `onDrop={(e) => {
             e.preventDefault();
             e.stopPropagation();
             setDragOverTarget(null);
             setDragOverPosition(null);
             const rect = (e.currentTarget as Element).getBoundingClientRect();
             const y = e.clientY - rect.top;
             if (node.type === 'group' && y > rect.height * 0.25 && y < rect.height * 0.75) {
                handleDrop(e, node.id, 'inside');
             } else if (y < rect.height / 2) {
                handleDrop(e, node.id, 'above');
             } else {
                handleDrop(e, node.id, 'below');
             }
          }}`
);

code = code.replace(
  /return \(\n\s*<div key=\{node\.id\}>/,
  `return (
      <div key={node.id} className="relative">
        {dragOverTarget === node.id && dragOverPosition === 'above' && (
           <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500 z-10 pointer-events-none shadow-[0_0_8px_#10b981]" />
        )}
`
);

// fix style replacement for inner drag target
code = code.replace(
  /style=\{\{ paddingLeft: `\$\{depth \* 12 \+ 8\}px` \}\}/g,
  `style={{ paddingLeft: \`\${depth * 12 + 8}px\`, ...(dragOverTarget === node.id && dragOverPosition === 'inside' ? { boxShadow: 'inset 0 0 0 2px #10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)' } : {}) }}`
);

// Add bottom border for 'below'
code = code.replace(
  /<div \n\s*onMouseEnter/g, // wait this is before the children
  function(match) { return match; }
);

// We need to inject the "below" border AFTER the node div but before children? 
// No, the node itself is `<div onMouseEnter...>` and its children are inside a check `if(node.children && node.isExpanded)`.
// Let's just put it together with `above`
code = code.replace(
  /\{dragOverTarget === node\.id && dragOverPosition === 'above' && \([\s\S]*?\)\}/,
  `$&
        {dragOverTarget === node.id && dragOverPosition === 'below' && (
           <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 z-10 pointer-events-none shadow-[0_0_8px_#10b981]" style={{ bottom: node.children && node.isExpanded ? 'auto' : 0, top: node.children && node.isExpanded ? '28px' : 'auto' }} />
        )}`
);

fs.writeFileSync('src/LayerEditor.tsx', code);
