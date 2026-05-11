import fs from 'fs';
let lines = fs.readFileSync('src/App.tsx', 'utf8').split(/\r?\n/);
lines[678] = "          title.textContent = `data-name: ${name}\\n\\nProperties:\\n${props.replace(/ \\\\| /g, '\\n')}`;";
lines.splice(679, 4);
fs.writeFileSync('src/App.tsx', lines.join('\n'));
