const fs = require('fs');
let code = fs.readFileSync('src/LayerEditor.tsx', 'utf-8');

// Replace the <div className="..." onClick={...}> element rendering the node
const startMarker = '<div \n          className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer text-xs group/item';

const replacement = `<div 
          onMouseEnter={() => setHoveredNodeId(node.id)}
          onMouseLeave={() => setHoveredNodeId(null)}
          className={\`flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer text-xs group/item transition-all duration-200
            \${selectedIds.has(node.id) ? (isDark ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-emerald-50 text-emerald-600 border border-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]') : 'border border-transparent hover:bg-black/5 dark:hover:bg-white/5'}
            \${!node.isVisible ? 'opacity-40' : ''}
          \`}`;

code = code.replace(
  /<div \s*className=\{\`flex items-center gap-1\.5 py-1\.5 px-2 rounded-lg cursor-pointer text-xs group\/item\s*\$\{selectedIds\.has\(node\.id\)[^}]+\}\s*\$\{!node\.isVisible \? 'opacity-40' : ''\}\s*\`\}/m,
  replacement
);

fs.writeFileSync('src/LayerEditor.tsx', code);
