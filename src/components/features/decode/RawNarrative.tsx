
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
  
  // 🚀 核心新增：全局逃逸坐标系状态 
  const [hoverInfo, setHoverInfo] = useState<{ text: string, x: number, y: number } | null>(null); 

  const handleMouseEnter = (e: React.MouseEvent, text: string) => { 
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); 
    // 算法：获取元素屏幕坐标，并增加安全边界 (确保气泡不会被挤出浏览器左右边界) 
    const safeX = Math.max(150, Math.min(window.innerWidth - 150, rect.left + rect.width / 2)); 
    setHoverInfo({ text, x: safeX, y: rect.top }); 
  }; 

  const renderRawText = () => { 
    if (!rawContent) return null; 

    const keys = Object.keys(dictionary).filter(k => k.trim() !== ''); 
    
    // 降级匹配逻辑 (针对历史无词典数据) 
    if (keys.length === 0) { 
      let activeWords: string[] = Array.isArray(fluffWords) ? fluffWords : (fluffWords?.[lang] || []); 
      if (activeWords.length === 0) return rawContent; 
      try { 
        const safeWords = activeWords 
          .filter(w => typeof w === 'string' && w.length > 0) 
          .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); 
        const regex = new RegExp(`(${safeWords.join('|')})`, 'g'); 
        const parts = rawContent.split(regex); 
        return parts.map((part, i) => { 
          const isMatch = activeWords.includes(part); 
          return isMatch ? ( 
            <mark key={i} className="bg-red-600/10 text-red-500 px-0.5 border-b border-red-500/50 transition-all hover:bg-red-600/30 cursor-crosshair"> 
              {part} 
            </mark> 
          ) : <span key={i} className="opacity-80">{part}</span>; 
        }); 
      } catch (e) { return rawContent; } 
    } 

    // 🚀 高阶渲染：彻底剥离内嵌 Tooltip，改为触发 Hover 坐标 
    try { 
      const regex = new RegExp(`(${keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g'); 
      const parts = rawContent.split(regex); 

      return parts.map((part, i) => { 
        if (dictionary[part]) { 
          return ( 
            <mark 
              key={i} 
              onMouseEnter={(e) => handleMouseEnter(e, dictionary[part])} 
              onMouseLeave={() => setHoverInfo(null)} 
              className="bg-red-600/20 text-red-500 px-1 rounded-sm border-b border-red-500/50 transition-all hover:bg-red-600/40 cursor-help" 
            > 
              {part} 
            </mark> 
          ); 
        } 
        return <span key={i} className="opacity-80">{part}</span>; 
      }); 
    } catch (e) { 
      return <span className="opacity-80">{rawContent}</span>; 
    } 
  }; 

  return ( 
    <> 
      <div className="bg-black border border-zinc-900 rounded-sm overflow-hidden shadow-2xl h-full flex flex-col relative"> 
        <div className="bg-zinc-900/30 px-6 py-3 border-b border-zinc-900 flex items-center justify-between shrink-0"> 
           <div className="flex items-center gap-3"> 
              <FileText size={14} className="text-zinc-500" /> 
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Evidence_File_Raw.txt</span> 
           </div> 
           <div className="flex items-center gap-2"> 
              <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" /> 
              <span className="text-[9px] font-mono text-red-900">INTERCEPTED</span> 
           </div> 
        </div> 
        
        <div className="p-8 md:p-12 relative flex-1 overflow-y-auto max-h-[800px] scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"> 
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] z-10 pointer-events-none bg-[length:100%_4px,3px_100%]"></div> 
          <div className="relative z-20 font-serif text-base leading-[2] text-zinc-400 tracking-wide text-justify"> 
            {renderRawText()} 
          </div> 
        </div> 

        <div className="bg-zinc-900/10 px-6 py-4 border-t border-zinc-900 flex justify-between items-center font-mono text-[8px] text-zinc-700 shrink-0"> 
           <span>SHA-256: 8f92b...d3e1</span> 
           <span>SECURITY LEVEL: CLASSIFIED</span> 
        </div> 
      </div> 

      {/* 🚀 逃逸渲染层：脱离 Overflow 裁剪的全局固定气泡 */} 
      {hoverInfo && ( 
        <div 
          className="fixed z-[9999] w-max max-w-[280px] bg-black border border-red-900 text-zinc-300 text-xs p-4 rounded-sm shadow-[0_0_40px_rgba(185,28,28,0.8)] pointer-events-none transform -translate-x-1/2 -translate-y-full leading-relaxed text-left font-sans transition-all duration-75" 
          style={{ left: hoverInfo.x, top: hoverInfo.y - 10 }} 
        > 
          <span className="text-red-500 flex items-center gap-2 mb-2 font-mono uppercase tracking-widest font-bold border-b border-red-900/50 pb-2"> 
            <Zap size={12} /> 真相破译 
          </span> 
          {hoverInfo.text} 
        </div> 
      )} 
    </> 
  ); 
}
