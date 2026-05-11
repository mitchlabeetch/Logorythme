import fs from 'fs';
let content = fs.readFileSync('src/LayerEditor.tsx', 'utf8');
content = content.replace(/\\`/g, '`');
content = content.replace(/\\\$/g, '$');
fs.writeFileSync('src/LayerEditor.tsx', content);
