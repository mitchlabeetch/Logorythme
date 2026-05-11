import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.split('\\n').join('\n');
fs.writeFileSync('src/App.tsx', content);
