const fs = require('fs');
let code = fs.readFileSync('src/LayerEditor.tsx', 'utf-8');

if (!code.includes('const [dragOverTarget,')) {
    code = code.replace(
      'const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);',
      'const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);\n  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);\n  const [dragOverPosition, setDragOverPosition] = useState<\'above\' | \'below\' | \'inside\' | null>(null);\n  const [dragItem, setDragItem] = useState<string | null>(null);\n  const [dragKeys, setDragKeys] = useState<Set<string>>(new Set());'
    );
}

// Ensure findPath exists. Was there one?
// Wait, the error is: `src/LayerEditor.tsx(314,19): error TS2304: Cannot find name 'findPath'.`
// Ah, `handleUngroup` is added BEFORE `findPath`! 
// Let's move `handleUngroup` below `findPath`.

code = code.replace(
  /const handleUngroup = \(\) => \{[\s\S]*?const handleRenameGroup = \(\) => \{[\s\S]*?const handleGroup = \(\) => \{/,
  'const handleGroup = () => {'
); // remove those functions because they are above `findPath`.

// find the place AFTER `findPath` to add them.
// findPath: `const findPath = (nodes: LayerNode[], id: string, currentPath: LayerNode[]): LayerNode[] | null => {`
if (code.includes('const findPath')) {
    code = code.replace(
       /const findPath = \([\s\S]*?return null;\n\s*\};/,
       `$&
  const handleUngroup = () => {
     if (selectedIds.size === 0) return;
     const activeLayers = pendingLayers || layers;
     const newLayers = JSON.parse(JSON.stringify(activeLayers));
     
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
`
    );
}

// Add setDragItem to handleDragStart
code = code.replace(
  /const handleDragStart = \(e: DragEvent<HTMLDivElement>, id: string\) => \{/,
  `$&
    setDragItem(id);`
);

// clear dragItem onDrop
code = code.replace(
  /const handleDrop = \([\s\S]*?\) => \{/,
  `$&
    setDragItem(null);`
);

fs.writeFileSync('src/LayerEditor_patch.ts', code);
// wait, I wrote LayerEditor_patch.ts, let's write LayerEditor.tsx directly
fs.writeFileSync('src/LayerEditor.tsx', code);
