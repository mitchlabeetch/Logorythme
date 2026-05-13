const fs = require('fs');
let code = fs.readFileSync('src/LayerEditor.tsx', 'utf-8');

// 1. Add Select All functionality
if (!code.includes('handleSelectAll')) {
  code = code.replace(
    /const handleGroup = \(\) => \{/,
    `const handleSelectAll = () => {
    const activeLayers = pendingLayers || layers;
    const all = activeLayers.flatMap(n => flatten(n));
    const newSel = new Set<string>();
    all.forEach(n => { if (n.isVisible) newSel.add(n.id); });
    setSelectedIds(newSel);
  };
  
  const handleUngroup = () => {
     if (selectedIds.size === 0) return;
     const activeLayers = pendingLayers || layers;
     const newLayers = JSON.parse(JSON.stringify(activeLayers));
     
     // Ungroup only if the top selection is a group
     const selectedIdsArray = Array.from(selectedIds);
     const firstSelectedId = selectedIdsArray[0] as string;
     const path = findPath(newLayers, firstSelectedId, []);
     if (!path) return;
     
     const node = path[path.length - 1];
     if (node.type !== 'group') return;
     if (node.isLocked) return;
     
     if (path.length === 1) { // Root level
        const idx = newLayers.findIndex((n: any) => n.id === node.id);
        if (idx > -1) {
             newLayers.splice(idx, 1, ...node.children);
        }
     } else {
        const parent = path[path.length - 2];
        const idx = parent.children.findIndex((n: any) => n.id === node.id);
        if (idx > -1) {
             parent.children.splice(idx, 1, ...node.children);
        }
     }
     
     setPendingLayers(newLayers);
     setSelectedIds(new Set(node.children.map((c: any) => c.id)));
  };
  
  const handleRenameGroup = () => {
       const selectedIdsArray = Array.from(selectedIds);
       if (selectedIdsArray.length === 1) {
            setEditingId(selectedIdsArray[0]);
            const path = findPath(pendingLayers || layers, selectedIdsArray[0], []);
            if (path && path[path.length - 1]) setEditName(path[path.length - 1].name);
       }
  };
  
  const handleGroup = () => {`
  );
}

// 2. Add buttons to Top Bar
code = code.replace(
  /<button \n\s*onClick=\{handleGroup\}/,
  `<button onClick={handleSelectAll} className="text-xs flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity px-2 py-1 bg-black/5 dark:bg-white/5 rounded active:scale-95 cursor-pointer" title="Select All" aria-label="Select All">
             <span className="hidden sm:inline">Select All</span>
           </button>
           <button 
             onClick={handleUngroup} 
             disabled={selectedIds.size === 0 || Array.from(selectedIds).some(sid => (pendingLayers||layers).flatMap(n=>flatten(n)).find(n=>n.id===sid && n.type !== 'group'))}
             className="text-xs flex items-center gap-1 opacity-60 hover:opacity-100 disabled:opacity-20 transition-opacity px-2 py-1 bg-black/5 dark:bg-white/5 rounded active:scale-95 cursor-pointer"
             title="Ungroup" aria-label="Ungroup"
           >
             <span className="hidden sm:inline">Ungroup</span>
           </button>
           <button 
             onClick={handleRenameGroup} 
             disabled={selectedIds.size !== 1}
             className="text-xs flex items-center gap-1 opacity-60 hover:opacity-100 disabled:opacity-20 transition-opacity px-2 py-1 bg-black/5 dark:bg-white/5 rounded active:scale-95 cursor-pointer"
             title="Rename" aria-label="Rename"
           >
             <span className="hidden sm:inline">Rename</span>
           </button>
           $&`
);

fs.writeFileSync('src/LayerEditor.tsx', code);
