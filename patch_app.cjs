const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

const replacements = [
  ['Drop your raster images anywhere to begin', "{t('dropToBegin')}"],
  ['<span className="text-[9px] uppercase tracking-widest opacity-0 group-hover:opacity-60 transition-opacity">Show Details</span>',
   '<span className="text-[9px] uppercase tracking-widest opacity-0 group-hover:opacity-60 transition-opacity">{t("showDetails")}</span>'],
  ['View Stack Trace', "{t('viewStackTrace')}"],
  ['Apply Settings', "{t('applySettings')}"],
  ['<option value="high">High Fidelity (Most Details)</option>',
   '<option value="high">{t("qualityHigh")}</option>'],
  ['<option value="optimized">Optimized (Balanced)</option>',
   '<option value="optimized">{t("qualityOptimized")}</option>'],
  ['<option value="minimal">Minimal (Flat vectors)</option>',
   '<option value="minimal">{t("qualityMinimal")}</option>'],
  ['Select or Upload an Image', "{t('emptyStateTitle')}"],
  ['Drop a raster logo anywhere to start its AI vectorization process.', "{t('emptyStateDesc')}"],
  ['>Original Image<', ">{t('originalImage')}<"],
  ['PAN {Math', "{t('pan')} {Math"],
  ['ZOOM {Math', "{t('zoom')} {Math"],
  ['>Awaiting Render<', ">{t('awaitingRender')}<"],
  ['Vector Rendering', "{t('vectorRendering')}"],
  ['Line {err.line}', "{t('line')} {err.line}"],
  ['No attributes tracked', "{t('noAttributesTracked')}"],
  ['+ Add Images', "{t('addImages')}"],
  ['title="Zoom In"', 'title={t("zoomIn")}'],
  ['title="Zoom Out"', 'title={t("zoomOut")}'],
  ['title="Fit Screen"', 'title={t("fitScreen")}'],
  ['title="Process / Regenerate"', 'title={t("processRegenerate")}'],
  ['aria-label="Process / Regenerate"', 'aria-label={t("processRegenerate")}'],
  ['title="Undo Modification" aria-label="Undo Edit"', 'title={t("undoEdit")} aria-label={t("undoEdit")}'],
  ['title="Redo Modification" aria-label="Redo Edit"', 'title={t("redoEdit")} aria-label={t("redoEdit")}'],
  ['Semantic Parts Detected', "{t('semanticParts')}"]
];

replacements.forEach(([from, to]) => {
  code = code.split(from).join(to);
});

fs.writeFileSync('src/App.tsx', code);
