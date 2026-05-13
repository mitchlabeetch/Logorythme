const fs = require('fs');
let code = fs.readFileSync('src/LayerEditor.tsx', 'utf-8');

code = code.replace(
  /const found = findNodeById\(pendingLayers \|\| layers, selectedIdsArray\[0\]\);/,
  'const found = findNodeById(pendingLayers || layers, selectedIdsArray[0] as string);'
);

fs.writeFileSync('src/LayerEditor.tsx', code);
