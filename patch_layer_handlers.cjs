const fs = require('fs');
let code = fs.readFileSync('src/LayerEditor.tsx', 'utf-8');

// The file got slightly mangled with findPath and handleUngroup. 
// Let's redefine handleUngroup, handleRenameGroup at the component level properly.

// First, clean up the injected code.
// I injected handleUngroup after findPath. Let's find exactly what's there and remove it.

code = code.replace(
  /\n\s*const handleUngroup = \(\) => \{[\s\S]*?const handleRenameGroup = \(\) => \{[\s\S]*?\}\s*;\s*/,
  '\n'
);

// We need to define them near handleGroup.
// Let's inject them right before `const handleGroup = () => {`
// Also `findNodeById` helper.

const helpersAndHandlers = `
  const findNodeById = (nodes: LayerNode[], id: string): { node: LayerNode, parent: LayerNode | null, index: number } | null => {
    for (let i = 0; i < nodes.length; i++) {
       if (nodes[i].id === id) return { node: nodes[i], parent: null, index: i };
       const found = findNodeByIdInParent(nodes[i], id);
       if (found) return found;
    }
    return null;
  };
  
  const findNodeByIdInParent = (parent: LayerNode, id: string): { node: LayerNode, parent: LayerNode | null, index: number } | null => {
    for (let i = 0; i < parent.children.length; i++) {
        if (parent.children[i].id === id) return { node: parent.children[i], parent, index: i };
        const found = findNodeByIdInParent(parent.children[i], id);
        if (found) return found;
    }
    return null;
  };

  const handleSelectAll = () => {
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
     
     const selectedIdsArray = Array.from(selectedIds);
     const firstSelectedId = selectedIdsArray[0] as string;
     
     const found = findNodeById(newLayers, firstSelectedId);
     if (!found) return;
     
     const { node, parent, index } = found;
     if (node.type !== 'group' || node.isLocked) return;
     
     if (parent) {
        parent.children.splice(index, 1, ...node.children);
     } else {
        newLayers.splice(index, 1, ...node.children);
     }
     
     setPendingLayers(newLayers);
     setSelectedIds(new Set(node.children.map((c: any) => c.id)));
  };
  
  const handleRenameGroup = () => {
       const selectedIdsArray = Array.from(selectedIds);
       if (selectedIdsArray.length === 1) {
            setEditingId(selectedIdsArray[0]);
            const found = findNodeById(pendingLayers || layers, selectedIdsArray[0]);
            if (found) setEditName(found.node.name);
       }
  };
`;

// wait, handleSelectAll is already defined at line 298. Let's delete it if it's there.
code = code.replace(
  /\n\s*const handleSelectAll = \(\) => \{[\s\S]*?setSelectedIds\(newSel\);\n\s*\};/,
  ''
);

// Inject
code = code.replace(
  /const handleGroup = \(\) => \{/,
  helpersAndHandlers + '\n  const handleGroup = () => {'
);

fs.writeFileSync('src/LayerEditor.tsx', code);
