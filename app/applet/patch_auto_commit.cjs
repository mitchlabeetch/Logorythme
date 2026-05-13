const fs = require('fs');
let code = fs.readFileSync('src/LayerEditor.tsx', 'utf-8');

code = code.replace(
  /const finalList = insertNode\(intermediateList\);\s*setPendingLayers\(finalList\);/,
  `const finalList = insertNode(intermediateList);\n    commitSvgChange(finalList, true);`
);

code = code.replace(
  /setPendingLayers\(result\);\s*setEditingId\(null\);/,
  `commitSvgChange(result, true);\n    setEditingId(null);`
);

code = code.replace(
  /return \{ \.\.\.item, isVisible: newVis \};\s*\}\);\s*setPendingLayers\(result\);/,
  `return { ...item, isVisible: newVis };\n    });\n    commitSvgChange(result, true);`
);

code = code.replace(
  /return \{ \.\.\.item \};\s*\}\);\s*setPendingLayers\(result\);/,
  `return { ...item };\n    });\n    commitSvgChange(result, true);`
);

code = code.replace(
  /setPendingLayers\(newLayers\);\s*setSelectedIds\(new Set\(node\.children\.map\(\(c: any\) => c\.id\)\)\);/,
  `commitSvgChange(newLayers, true);\n     setSelectedIds(new Set(node.children.map((c: any) => c.id)));`
);

code = code.replace(
  /setSelectedIds\(new Set\(\[newGroup\.id\]\)\);\s*setPendingLayers\(filteredLayers\);/,
  `setSelectedIds(new Set([newGroup.id]));\n     commitSvgChange(filteredLayers, true);`
);

code = code.replace(
  /\{pendingLayers && \([\s\S]*?<\/div>\s*\)\}\s*<div className="flex flex-col gap-0\.5 max-h-\[300px\]/,
  `<div className="flex flex-col gap-0.5 max-h-[300px]`
);

fs.writeFileSync('src/LayerEditor.tsx', code);
