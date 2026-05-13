const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const badStyle = `highlightedLayerIds.map(id => \`[data-layer-id="\${id}"] { outline: 2px solid #10b981 !important; filter: drop-shadow(0 0 8px #10b981) brightness(1.5); }\`).join(' ')`;

const goodStyle = `highlightedLayerIds.map(id => \`
  [data-layer-id="\${id}"] {
    stroke: #10b981 !important;
    stroke-width: 3px !important;
    filter: drop-shadow(0 0 8px #10b981) brightness(1.2);
    vector-effect: non-scaling-stroke;
  }
\`).join(' ')`;

code = code.replace(badStyle, goodStyle);

fs.writeFileSync('src/App.tsx', code);
