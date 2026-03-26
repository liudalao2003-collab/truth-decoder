"use client"; 
import React, { useState } from 'react';
import { FileText, Zap } from 'lucide-react'; 

interface RawNarrativeProps { 
  rawContent: string; 
  fluffWords: any; 
  lang?: 'cn' | 'en';
  dictionary?: Record<string, string>; 
} 

export default function RawNarrative({ rawContent, fluffWords, lang = 'cn', dictionary = {} }: RawNarrativeProps) { 
  const [hoverInfo, setHoverInfo] = useState<{ text: string, x: number, y: number } | null>(null); 

  const handleMouseEnter = (e: React.MouseEvent, text: string) => { 
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const safeX = Math.max(150, Math.min(window.innerWidth - 150, rect.left + rect.width / 2));
    setHoverInfo({ text, x: safeX, y: rect.top }); 
  }; 

  const renderRawText = () => { 
    if (!rawContent) return null;
    
    // 1. 过滤空键，并按长度降序排列，防止“包含关系的短词”错误截断长词
    const keys = Object.keys(dictionary).filter(k => k.trim() !== '').sort((a, b) => b.length - a.length); 

    if (keys.length === 0) return <span className="opacity-80">{rawContent}</span>;

    let parts: (string | React.ReactNode)[] = [rawContent];
    const usedKeys = new Set<string>(); // 🚨 核心防线：全局去重账本

    keys.forEach((key, keyIndex) => {
      const newParts: (string | React.ReactNode)[] = [];
      let keyUsedInThisRun = false; // 确保该词在整个循环中只被高亮一次

      parts.forEach(part => {
        if (typeof part === 'string' && !keyUsedInThisRun) {
          const idx = part.indexOf(key);
          if (idx !== -1) {
            newParts.push(part.substring(0, idx));
            newParts.push(
              <mark
                key={`mark-${keyIndex}`}
                onMouseEnter={(e) => handleMouseEnter(e, dictionary[key])}
                onMouseLeave={() => setHoverInfo(null)}
                className="bg-red-600/20 text-red-500 px-1 rounded-sm border-b border-red-500/50 transition-all hover:bg-red-600/40 cursor-help"
              >
                {key}
              </mark>
            );
            newParts.push(part.substring(idx + key.length));
            keyUsedInThisRun = true;
          } else {
            newParts.push(part);
          }
        } else {
          newParts.push(part);
        }
      });
      parts = newParts;
    });

    return parts.map((p, i) => (typeof p === 'string' ? <span key={i} className="opacity-80">{p}</span> : p));
  };

  return ( 
    <> 
      <div className="bg-black border border-zinc-900 rounded-sm overflow-hidden shadow-2xl h-full flex flex-col relative"> 
        <div className="bg-zinc-900/30 px-6 py-3 border-b border-zinc-900 flex items-center justify-between shrink-0"> 
           <div className="flex items-center gap-3"> 
              <FileText size={14} className="text-zinc-500" /> 
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                {lang === 'cn' ? 'Evidence_File_Raw.txt' : 'Source_Material_Untouched.log'}
              </span> 
           </div> 
           <div className="flex items-center gap-2"> 
              <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" /> 
              <span className="text-[9px] font-mono text-red-900">INTERCEPTED</span> 
           </div> 
        </div> 
        
        {/* 🚨 补充 whitespace-pre-wrap 确保原文换行不会黏在一起 */}
        <div className="p-8 md:p-12 relative flex-1 overflow-y-auto max-h-[800px] scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"> 
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] z-10 pointer-events-none bg-[length:100%_4px,3px_100%]"></div> 
          <div className="relative z-20 font-serif text-base leading-[2] text-zinc-400 tracking-wide text-justify whitespace-pre-wrap"> 
            {renderRawText()} 
          </div> 
        </div> 

        <div className="bg-zinc-900/10 px-6 py-4 border-t border-zinc-900 flex justify-between items-center font-mono text-[8px] text-zinc-700 shrink-0"> 
           <span>SHA-256: 8f92b...d3e1</span> 
           <span>SECURITY LEVEL: CLASSIFIED</span> 
        </div> 
      </div> 

      {hoverInfo && ( 
        <div 
          className="fixed z-[9999] w-max max-w-[280px] bg-black border border-red-900 text-zinc-300 text-xs p-4 rounded-sm shadow-[0_0_40px_rgba(185,28,28,0.8)] pointer-events-none transform -translate-x-1/2 -translate-y-full leading-relaxed text-left font-sans transition-all duration-75" 
          style={{ left: hoverInfo.x, top: hoverInfo.y - 10 }} 
        > 
          <span className="text-red-500 flex items-center gap-2 mb-2 font-mono uppercase tracking-widest font-bold border-b border-red-900/50 pb-2"> 
            <Zap size={12} /> {lang === 'cn' ? '真相破译' : 'DECODED MOTIVE'}
          </span> 
          {hoverInfo.text} 
        </div> 
      )} 
    </> 
  ); 
}