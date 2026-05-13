import React, { useState, useEffect } from 'react';

export const ProcessingTerminal = ({ stageName }: { stageName: string }) => {
  const [logs, setLogs] = useState<string[]>([]);
  
  useEffect(() => {
    const rawLogs = [
      "Initializing AI pipeline...",
      "Allocating tensor core context layers...",
      "Processing raster input matrices...",
      "Analyzing morphological boundaries...",
      "Extracting dominant cluster centroids...",
      "Reconstructing bezier topologies...",
      "Optimizing curve approximations...",
      "Eliminating micro-artifacts...",
      "Aligning anchor tangents...",
      "Validating SVG structural hierarchy...",
      "Constructing bounding paths...",
      "Applying precision constraints...",
      "Reducing vector footprint...",
      "Minifying generated DOM elements...",
      "Synchronizing color palettes...",
      "Executing final SVG render pass...",
      "Awaiting stream conclusion..."
    ];
    const interval = setInterval(() => {
      setLogs(prev => {
        const newLogs = [...prev, `[${new Date().toISOString().substring(11, 23)}] ${rawLogs[Math.floor(Math.random() * rawLogs.length)]}`];
        return newLogs.slice(-6);
      });
    }, 400 + Math.random() * 300);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-sm mt-8 rounded-xl bg-[#0a0a0a] border border-emerald-500/20 shadow-2xl overflow-hidden backdrop-blur-xl">
       <div className="flex items-center px-4 py-2 border-b border-white/5 bg-white/5">
          <div className="flex gap-1.5">
             <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
             <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></div>
             <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></div>
          </div>
          <div className="ml-4 text-[10px] font-mono text-emerald-500/60 tracking-wider">
            V-ENGINE EXTRACTOR
          </div>
       </div>
       <div className="p-4 font-mono text-[10px] sm:text-xs leading-relaxed text-emerald-400/80 h-32 flex flex-col justify-end">
          {logs.map((log, i) => (
            <div key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-300 truncate">
               {log}
            </div>
          ))}
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-emerald-500/10">
            <span className="w-2 h-4 bg-emerald-400 animate-pulse"></span>
            <span className="text-emerald-300 font-bold uppercase tracking-widest">{stageName}</span>
          </div>
       </div>
    </div>
  );
};
