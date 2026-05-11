import React, { useState, useEffect, DragEvent } from 'react';
import { Layers, Folder, Image as ImageIcon, ChevronRight, ChevronDown, Trash2, Edit2, GripVertical, Check, Plus, Undo, Redo, Save, X, Lock, Unlock, Eye, EyeOff, Palette } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface LayerEditorProps {
  svgBase64: string;
  itemId: string;
  onUpdate: (itemId: string, newSvgBase64: string) => void;
  isDark: boolean;
}

interface LayerNode {
  id: string; // The xpath or a unique index representing its path
  name: string;
  type: string; // 'group' | 'path' | 'rect' etc
  children: LayerNode[];
  isExpanded: boolean;
  isVisible: boolean;
  isLocked: boolean;
  fillColor?: string;
  strokeColor?: string;
  domRef: Element;
}

export const LayerEditor: React.FC<LayerEditorProps> = ({ svgBase64, itemId, onUpdate, isDark }) => {
  const { t } = useTranslation();
  const [layers, setLayers] = useState<LayerNode[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
  // Pending changes for "Apply/Cancel" functionality
  const [pendingLayers, setPendingLayers] = useState<LayerNode[] | null>(null);
  
  // Parse SVG into layers
  useEffect(() => {
    try {
      const rawSvg = atob(svgBase64);
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawSvg, "image/svg+xml");
      
      let uid = 0;
      const buildTree = (el: Element, parentPath: string): LayerNode[] => {
        const result: LayerNode[] = [];
        Array.from(el.children).forEach((child, i) => {
          if (child.tagName === 'title' || child.tagName === 'defs' || child.tagName === 'style' || child.tagName === 'script') return;
          
          const id = `${parentPath}-${i}-${uid++}`;
          const name = child.getAttribute('data-name') || child.tagName;
          const type = child.tagName === 'g' ? 'group' : child.tagName;
          const isVisible = child.getAttribute('display') !== 'none' && child.getAttribute('visibility') !== 'hidden';
          const isLocked = child.getAttribute('data-locked') === 'true';
          
          let fillColor = child.getAttribute('fill') || undefined;
          let strokeColor = child.getAttribute('stroke') || undefined;
          
          if (!fillColor) {
             const styleStr = child.getAttribute('style') || "";
             const match = styleStr.match(/fill:\s*([^;]+)/);
             if (match) fillColor = match[1];
          }
          if (!strokeColor) {
             const styleStr = child.getAttribute('style') || "";
             const match = styleStr.match(/stroke:\s*([^;]+)/);
             if (match) strokeColor = match[1];
          }

          if (fillColor && !fillColor.startsWith('#')) {
             if (fillColor === 'none') fillColor = undefined;
          }
          if (strokeColor && !strokeColor.startsWith('#')) {
             if (strokeColor === 'none') strokeColor = undefined;
          }
          
          const node: LayerNode = {
            id,
            name,
            type,
            children: child.tagName === 'g' ? buildTree(child, id) : [],
            isExpanded: true,
            isVisible,
            isLocked,
            fillColor,
            strokeColor,
            domRef: child
          };
          result.push(node);
        });
        return result;
      };
      
      const svgRoot = doc.querySelector('svg');
      if (svgRoot) {
        setLayers(buildTree(svgRoot, 'root'));
        setPendingLayers(null); // Reset pending on new SVG
      }
    } catch(err) {}
  }, [svgBase64]);

  const commitSvgChange = (nodes: LayerNode[], immediate: boolean = false) => {
    if (!immediate) {
       setPendingLayers(nodes);
       return;
    }
    
    try {
      const rawSvg = atob(svgBase64);
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawSvg, "image/svg+xml");
      const root = doc.querySelector('svg');
      if (!root) return;
      
      // Preserve defs/style/title
      const preserves = Array.from(root.children).filter(c => ['title', 'defs', 'style', 'script'].includes(c.tagName));
      
      root.innerHTML = '';
      preserves.forEach(p => root.appendChild(p));
      
      const appendRecursive = (parent: Element, nodeList: LayerNode[]) => {
        nodeList.forEach(node => {
          const newEl = node.domRef.cloneNode(true) as Element;
          if (node.type === 'group') {
             // Clear children and rebuild
             newEl.innerHTML = '';
             appendRecursive(newEl, node.children);
          }
          parent.appendChild(newEl);
        });
      };
      
      appendRecursive(root, nodes);
      
      const ser = new XMLSerializer();
      onUpdate(itemId, btoa(ser.serializeToString(doc)));
      setPendingLayers(null);
    } catch(err) {}
  };

  const handleDragStart = (e: DragEvent, id: string) => {
    e.dataTransfer.setData('layerId', id);
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent, targetId: string, position: 'before' | 'inside' | 'after') => {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = e.dataTransfer.getData('layerId');
    if (sourceId === targetId || !sourceId) return;

    let sourceNode: LayerNode | null = null;
    
    const activeLayers = pendingLayers || layers;
    
    // Check if source node is locked
    const findNode = (list: LayerNode[], lid: string): LayerNode | null => {
        for (const item of list) {
            if (item.id === lid) return item;
            const found = findNode(item.children, lid);
            if (found) return found;
        }
        return null;
    }
    const targetSrcNode = findNode(activeLayers, sourceId);
    if (!targetSrcNode || targetSrcNode.isLocked) return;
    
    // Remove source node
    const removeNode = (list: LayerNode[]): LayerNode[] => {
      const newList = [...list];
      for (let i = 0; i < newList.length; i++) {
        if (newList[i].id === sourceId) {
          sourceNode = newList.splice(i, 1)[0];
          return newList;
        }
        if (newList[i].children.length > 0) {
          newList[i] = { ...newList[i], children: removeNode(newList[i].children) };
        }
      }
      return newList;
    };
    
    const intermediateList = removeNode(activeLayers);
    if (!sourceNode) return; // Prevent parent into child

    // Insert source node
    const insertNode = (list: LayerNode[]): LayerNode[] => {
      const newList = [...list];
      for (let i = 0; i < newList.length; i++) {
        if (newList[i].id === targetId) {
          if (position === 'inside' && newList[i].type === 'group') {
            newList[i] = { ...newList[i], children: [...newList[i].children, sourceNode!] };
          } else if (position === 'before') {
            newList.splice(i, 0, sourceNode!);
            return newList;  // Stop processing other elements
          } else if (position === 'after') {
            newList.splice(i + 1, 0, sourceNode!);
            return newList;
          }
        } else if (newList[i].children.length > 0) {
          newList[i] = { ...newList[i], children: insertNode(newList[i].children) };
        }
      }
      return newList;
    };

    const finalList = insertNode(intermediateList);
    setPendingLayers(finalList);
  };

  const updateAttr = (list: LayerNode[], id: string, op: (item: LayerNode) => LayerNode): LayerNode[] => {
      return list.map(item => {
        if (item.id === id) {
          return op(item);
        }
        if (item.children.length > 0) {
          return { ...item, children: updateAttr(item.children, id, op) };
        }
        return item;
      });
  };

  const handleRename = (id: string, newName: string) => {
    const activeLayers = pendingLayers || layers;
    
    const node = [...activeLayers].flatMap(x => flatten(x)).find(x => x.id === id);
    if (node?.isLocked) return;

    const result = updateAttr(activeLayers, id, item => {
       item.domRef.setAttribute('data-name', newName);
       return { ...item, name: newName };
    });
    setPendingLayers(result);
    setEditingId(null);
  };

  const toggleVisibility = (id: string) => {
    const activeLayers = pendingLayers || layers;
    const result = updateAttr(activeLayers, id, item => {
       const newVis = !item.isVisible;
       if (!newVis) item.domRef.setAttribute('display', 'none');
       else item.domRef.removeAttribute('display');
       return { ...item, isVisible: newVis };
    });
    setPendingLayers(result);
  };

  const toggleLock = (id: string) => {
    const activeLayers = pendingLayers || layers;
    const result = updateAttr(activeLayers, id, item => {
       const newLock = !item.isLocked;
       if (newLock) item.domRef.setAttribute('data-locked', 'true');
       else item.domRef.removeAttribute('data-locked');
       return { ...item, isLocked: newLock };
    });
    // We can commit locks immediately to save them
    commitSvgChange(result, true);
  };

  const handleColorChange = (id: string, fillStr?: string, strokeStr?: string) => {
    const activeLayers = pendingLayers || layers;
    const result = updateAttr(activeLayers, id, item => {
       if (item.isLocked) return item;
       if (fillStr !== undefined) {
         if (fillStr === 'none' || fillStr === '') {
            item.domRef.removeAttribute('fill');
            item.fillColor = undefined;
         } else {
            item.domRef.setAttribute('fill', fillStr);
            item.fillColor = fillStr;
         }
       }
       if (strokeStr !== undefined) {
         if (strokeStr === 'none' || strokeStr === '') {
            item.domRef.removeAttribute('stroke');
            item.strokeColor = undefined;
         } else {
            item.domRef.setAttribute('stroke', strokeStr);
            item.strokeColor = strokeStr;
         }
       }
       return { ...item };
    });
    setPendingLayers(result);
  };

  const flatten = (node: LayerNode): LayerNode[] => [node, ...node.children.flatMap(children => flatten(children))];

  const handleGroup = () => {
     if (selectedIds.size === 0) return;
     
     const activeLayers = pendingLayers || layers;
     
     // Check if any selected is locked
     const allNodes = activeLayers.flatMap(n => flatten(n));
     for (const sid of Array.from(selectedIds)) {
         if (allNodes.find(n => n.id === sid)?.isLocked) return; // Prevent grouping if locked
     }
     
     let collectedNodes: LayerNode[] = [];
     let firstInsertIndexPath: number[] | null = null;
     
     const findPath = (list: LayerNode[], id: string, currentPath: number[]): number[] | null => {
        for (let i = 0; i < list.length; i++) {
           if (list[i].id === id) return [...currentPath, i];
           if (list[i].children.length > 0) {
              const res = findPath(list[i].children, id, [...currentPath, i]);
              if (res) return res;
           }
        }
        return null;
     };

     const selectedIdsArray = Array.from(selectedIds);
     const firstSelectedId = selectedIdsArray[0] as string;
     if (firstSelectedId) {
        firstInsertIndexPath = findPath(activeLayers, firstSelectedId, []);
     }

     const removeSelected = (list: LayerNode[]): LayerNode[] => {
       const newList = [...list];
       for (let i = newList.length - 1; i >= 0; i--) {
         if (selectedIds.has(newList[i].id)) {
           collectedNodes.unshift(newList.splice(i, 1)[0]);
         } else if (newList[i].children.length > 0) {
           newList[i] = { ...newList[i], children: removeSelected(newList[i].children) };
         }
       }
       return newList;
     };
     
     let filteredLayers = removeSelected(activeLayers);
     if (collectedNodes.length === 0) return;
     
     const newGroupDom = document.createElementNS("http://www.w3.org/2000/svg", "g");
     newGroupDom.setAttribute("data-name", t('editorNewGroup'));
     
     const newGroup: LayerNode = {
       id: `group-${Date.now()}`,
       name: t('editorNewGroup'),
       type: 'group',
       children: collectedNodes,
       isExpanded: true,
       isVisible: true,
       isLocked: false,
       domRef: newGroupDom
     };
     
     // Insert at the first path found
     const insertAtPath = (list: LayerNode[], path: number[], index: number): LayerNode[] => {
         if (index === path.length - 1) {
             const newList = [...list];
             // Ensure we dont go out of bounds since we removed items
             newList.splice(Math.min(path[index], newList.length), 0, newGroup);
             return newList;
         }
         const newList = [...list];
         if (newList[path[index]]) {
            newList[path[index]] = {
               ...newList[path[index]],
               children: insertAtPath(newList[path[index]].children, path, index + 1)
            };
         } else {
            newList.push(newGroup); // Fallback
         }
         return newList;
     };

     if (firstInsertIndexPath && firstInsertIndexPath.length > 0) {
         filteredLayers = insertAtPath(filteredLayers, firstInsertIndexPath, 0);
     } else {
         filteredLayers.push(newGroup);
     }
     
     setSelectedIds(new Set([newGroup.id]));
     setPendingLayers(filteredLayers);
  };

  const toggleSelection = (e: React.MouseEvent, id: string) => {
    const newSel = new Set(e.shiftKey || e.ctrlKey || e.metaKey ? selectedIds : []);
    if (newSel.has(id)) {
      newSel.delete(id);
    } else {
      newSel.add(id);
    }
    setSelectedIds(newSel);
  };

  const renderNodes = (nodes: LayerNode[], depth: number = 0) => {
    return nodes.map((node) => (
      <div key={node.id}>
        <div 
          className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer text-xs group/item
            ${selectedIds.has(node.id) ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600') : 'hover:bg-black/5 dark:hover:bg-white/5'}
            ${!node.isVisible ? 'opacity-40' : ''}
          `}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          draggable={!node.isLocked}
          onDragStart={(e) => handleDragStart(e, node.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
             const rect = (e.currentTarget as Element).getBoundingClientRect();
             const y = e.clientY - rect.top;
             if (node.type === 'group' && y > rect.height * 0.25 && y < rect.height * 0.75) {
                handleDrop(e, node.id, 'inside');
             } else if (y < rect.height / 2) {
                handleDrop(e, node.id, 'before');
             } else {
                handleDrop(e, node.id, 'after');
             }
          }}
          onClick={(e) => toggleSelection(e, node.id)}
        >
          <div className={`${node.isLocked ? 'text-black/10 dark:text-white/10 cursor-not-allowed' : 'text-black/30 dark:text-white/30 cursor-grab active:cursor-grabbing hover:text-emerald-500'}`} title={t('editorDrag')}>
             <GripVertical className="w-3 h-3" />
          </div>
          
          {node.type === 'group' ? (
            <div onClick={(e) => { 
                e.stopPropagation(); 
                const act = pendingLayers || layers;
                const toggleExp = (l: LayerNode[]): LayerNode[] => l.map(i => i.id === node.id ? {...i, isExpanded: !i.isExpanded} : {...i, children: toggleExp(i.children)});
                if (pendingLayers) {
                   setPendingLayers(toggleExp(pendingLayers));
                } else {
                   setLayers(toggleExp(layers));
                }
            }}>
              {node.isExpanded ? <ChevronDown className="w-3.5 h-3.5 opacity-60" /> : <ChevronRight className="w-3.5 h-3.5 opacity-60" />}
            </div>
          ) : (
            <ImageIcon className="w-3.5 h-3.5 opacity-40 ml-1" />
          )}

          {editingId === node.id && !node.isLocked ? (
            <div className="flex-1 flex items-center gap-1">
              <input 
                autoFocus 
                className="flex-1 bg-black/10 dark:bg-black/40 px-1.5 py-0.5 rounded outline-none border border-emerald-500/50" 
                value={editName} 
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRename(node.id, editName); if (e.key === 'Escape') setEditingId(null); }}
                onClick={e => e.stopPropagation()}
              />
              <button onClick={(e) => { e.stopPropagation(); handleRename(node.id, editName); }} className="hover:text-emerald-500"><Check className="w-3 h-3" /></button>
            </div>
          ) : (
            <div className="flex-1 truncate select-none" title={t('editorRename')} onDoubleClick={(e) => { if (!node.isLocked) { e.stopPropagation(); setEditingId(node.id); setEditName(node.name); } }}>
              {node.name}
            </div>
          )}

          <div className="flex items-center gap-1 ml-auto shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity" style={{ opacity: selectedIds.has(node.id) || node.isLocked || !node.isVisible ? 1 : undefined }}>
            <button onClick={(e) => { e.stopPropagation(); toggleLock(node.id); }} className={`p-1 ${node.isLocked ? 'text-amber-500 opacity-100' : 'opacity-40 hover:opacity-100 dark:text-white text-black'}`} title={t('editorLock')}>
              {node.isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); toggleVisibility(node.id); }} className={`p-1 ${!node.isVisible ? 'text-blue-500 opacity-100' : 'opacity-40 hover:opacity-100 dark:text-white text-black'}`} title={t('editorVisibility')}>
              {node.isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            </button>
            
            {node.fillColor !== undefined && !node.isLocked && (
               <div className="relative w-4 h-4 ml-1 rounded-full border border-black/20 dark:border-white/20 overflow-hidden" onClick={e => e.stopPropagation()} title={t('editorFillColor')}>
                  <input type="color" className="absolute -inset-2 w-8 h-8 cursor-pointer opacity-0" value={node.fillColor.startsWith('#') ? node.fillColor.substring(0, 7) : '#000000'} onChange={(e) => handleColorChange(node.id, e.target.value, undefined)} />
                  <div className="w-full h-full pointer-events-none" style={{ backgroundColor: node.fillColor.startsWith('#') ? node.fillColor : 'transparent' }} />
               </div>
            )}
            {node.strokeColor !== undefined && !node.isLocked && (
               <div className="relative w-4 h-4 ml-1 rounded-full border-2 border-black/20 dark:border-white/20 overflow-hidden flex items-center justify-center p-0.5" onClick={e => e.stopPropagation()} title={t('editorStrokeColor')}>
                  <input type="color" className="absolute -inset-2 w-8 h-8 cursor-pointer opacity-0" value={node.strokeColor.startsWith('#') ? node.strokeColor.substring(0, 7) : '#000000'} onChange={(e) => handleColorChange(node.id, undefined, e.target.value)} />
                  <div className="w-full h-full bg-transparent rounded-full border-2 pointer-events-none" style={{ borderColor: node.strokeColor.startsWith('#') ? node.strokeColor : 'transparent' }} />
               </div>
            )}
          </div>
        </div>

        {node.type === 'group' && node.isExpanded && node.children.length > 0 && (
          <div className="ml-2 border-l border-black/10 dark:border-white/10">
            {renderNodes(node.children, depth + 1)}
          </div>
        )}
      </div>
    ));
  };

  const activeLayers = pendingLayers || layers;

  if (activeLayers.length === 0) return null;
  const isAnyLocked = Array.from(selectedIds).some(sid => activeLayers.flatMap(n => flatten(n)).find(n => n.id === sid)?.isLocked);

  return (
    <div className="flex flex-col gap-2 mt-6 border-t border-black/10 dark:border-white/10 pt-4">
      <div className="flex items-center justify-between mb-2">
         <h4 className="text-xs uppercase font-bold tracking-[0.2em] opacity-60 flex items-center gap-2">
           <Layers className="w-3.5 h-3.5" /> {t('editorLayersTitle')}
         </h4>
         
         <div className="flex items-center gap-2">
           <button 
             onClick={handleGroup} 
             disabled={selectedIds.size === 0 || isAnyLocked}
             className="text-xs flex items-center gap-1 opacity-60 hover:opacity-100 disabled:opacity-20 transition-opacity px-2 py-1 bg-black/5 dark:bg-white/5 rounded active:scale-95 cursor-pointer"
             title={t('editorGroupTooltip')}
           >
             <Folder className="w-3 h-3" /> {t('editorGroupBtn')}
           </button>
         </div>
      </div>
      
      {pendingLayers && (
         <div className="flex gap-2 mb-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg shadow-sm">
           <button onClick={() => commitSvgChange(pendingLayers, true)} className="flex-1 py-1.5 flex items-center justify-center gap-2 text-xs font-bold rounded bg-emerald-500 hover:bg-emerald-600 text-white transition-all active:scale-95">
              <Save className="w-3 h-3" /> {t('editorApplyBtn')}
           </button>
           <button onClick={() => { setPendingLayers(null); setSelectedIds(new Set()); }} className="px-3 py-1.5 flex items-center justify-center gap-2 text-xs font-bold rounded bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-all active:scale-95">
              <X className="w-3 h-3" />
           </button>
         </div>
      )}
      
      <div className="flex flex-col gap-0.5 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar select-none group/layerlist">
         {renderNodes(activeLayers)}
      </div>
    </div>
  );
};
