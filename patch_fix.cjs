const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// target the bad code
const badCode = `
                                 {highlightedLayerIds.length > 0 && (
                                   <style>{\`\${highlightedLayerIds.map(id => \`[data-layer-id="\${id}"] { outline: 2px solid #10b981; filter: drop-shadow(0 0 8px #10b981) brightness(1.2); }\`).join(' ')}\`}</style>
                                 )}
                                 `;

code = code.replace(badCode, '');

// now insert it BEFORE the div that has the dangerouslySetInnerHTML
// Wait, the parent is <div className="absolute inset-0 overflow-hidden flex items-center justify-center cursor-default bg-[#e5e5e5] dark:bg-[#111111]" ...
// That's a good place for it.
code = code.replace(
  /<div className="absolute inset-0 overflow-hidden/,
  `{highlightedLayerIds.length > 0 && (
                               <style dangerouslySetInnerHTML={{ __html: highlightedLayerIds.map(id => \`[data-layer-id="\${id}"] { outline: 2px solid #10b981 !important; filter: drop-shadow(0 0 8px #10b981) brightness(1.5); }\`).join(' ') }} />
                             )}
                             <div className="absolute inset-0 overflow-hidden`
);

fs.writeFileSync('src/App.tsx', code);
