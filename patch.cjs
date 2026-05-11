const fs = require('fs');
let code = fs.readFileSync('src/i18n.ts', 'utf-8');

const enInsert = `,
       editorDrag: "Drag to reorder",
       dropToBegin: "Drop your raster images anywhere to begin",
       showDetails: "Show Details",
       viewStackTrace: "View Stack Trace",
       applySettings: "Apply Settings",
       qualityHigh: "High Fidelity (Most Details)",
       qualityOptimized: "Optimized (Balanced)",
       qualityMinimal: "Minimal (Flat vectors)",
       emptyStateTitle: "Select or Upload an Image",
       emptyStateDesc: "Drop a raster logo anywhere to start its AI vectorization process.",
       originalImage: "Original Image",
       pan: "PAN",
       zoom: "ZOOM",
       awaitingRender: "Awaiting Render",
       vectorRendering: "Vector Rendering",
       line: "Line",
       noAttributesTracked: "No attributes tracked",
       addImages: "+ Add Images",
       zoomIn: "Zoom In",
       zoomOut: "Zoom Out",
       fitScreen: "Fit Screen",
       processRegenerate: "Process / Regenerate",
       undoEdit: "Undo Edit",
       redoEdit: "Redo Edit",
       semanticParts: "Semantic Parts Detected"
     }
   },
   fr: {`;
code = code.replace(/,\n?\s*editorDrag:\s*"Drag to reorder"(\r?\n)?\s*\}(\r?\n)?\s*\},(\r?\n)?\s*fr:\s*\{/, enInsert);

const frInsert = `,
       editorDrag: "Glisser pour réorganiser",
       dropToBegin: "Déposez vos images matricielles n'importe où pour commencer",
       showDetails: "Afficher les détails",
       viewStackTrace: "Voir la trace de la pile",
       applySettings: "Appliquer les paramètres",
       qualityHigh: "Haute Fidélité (Plus de détails)",
       qualityOptimized: "Optimisé (Équilibré)",
       qualityMinimal: "Minimal (Vecteurs plats)",
       emptyStateTitle: "Sélectionnez ou téléchargez une image",
       emptyStateDesc: "Déposez un logo matriciel n'importe où pour commencer son processus de vectorisation IA.",
       originalImage: "Image d'origine",
       pan: "PAN",
       zoom: "ZOOM",
       awaitingRender: "En attente de rendu",
       vectorRendering: "Rendu Vectoriel",
       line: "Ligne",
       noAttributesTracked: "Aucun attribut suivi",
       addImages: "+ Ajouter des images",
       zoomIn: "Zoom avant",
       zoomOut: "Zoom arrière",
       fitScreen: "Ajuster à l'écran",
       processRegenerate: "Traiter / Régénérer",
       undoEdit: "Annuler la modification",
       redoEdit: "Rétablir la modification",
       semanticParts: "Parties sémantiques détectées"
     }
   }
};`;
code = code.replace(/,\n?\s*editorDrag:\s*"Glisser pour réorganiser"(\r?\n)?\s*\}(\r?\n)?\s*\}(\r?\n)?\s*\};/, frInsert);

fs.writeFileSync('src/i18n.ts', code);
