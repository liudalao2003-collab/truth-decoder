
"use client"; 
import React from 'react'; 
import { FileText, Zap } from 'lucide-react'; 

interface RawNarrativeProps { 
  rawContent: string; 
  fluffWords: any; 
  lang?: 'cn' | 'en'; 
  dictionary?: Record<string, string>; // 🚀 核心新增：接收底层翻译词典 
} 

/** 
 * 核心业务组件：原始案发现场 (Raw Intercept) 
 * 作用：展示被截获的原始通稿。如果传入了翻译词典，将自动高亮黑话，并提供鼠标悬停破译功能。 
 */ 
export default function RawNarrative({ rawContent, fluffWords, lang = 'cn', dictionary = {} }: RawNarrativeProps) { 
  
  const renderRawText = () => { 
    if (!rawContent) return null; 

    const keys = Object.keys(dictionary).filter(k => k.trim() !== ''); 
    
    // 如果没有生成词典（如历史旧数据），降级使用原有的纯数组匹配逻辑 
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

    // 🚀 高阶渲染：基于词典的精准切割与悬浮气泡 (Tooltip) 注入 
    try { 
      const regex = new RegExp(`(${keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g'); 
      const parts = rawContent.split(regex); 

      return parts.map((part, i) => { 
        if (dictionary[part]) { 
          return ( 
            <span key={i} className="relative group inline-block cursor-help mx-0.5"> 
              <mark className="bg-red-600/20 text-red-500 px-1 rounded-sm border-b border-red-500/50 transition-all group-hover:bg-red-600/40"> 
                {part} 
              </mark> 
              {/* 悬浮暗影面板 (Tooltip) */} 
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[280px] bg-black border border-red-900 text-zinc-300 text-xs p-4 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-[0_0_30px_rgba(185,28,28,0.4)] block leading-relaxed text-left font-sans"> 
                <span className="text-red-500 flex items-center gap-2 mb-2 font-mono uppercase tracking-widest font-bold border-b border-red-900/50 pb-2"> 
                  <Zap size={12} /> 真相破译 
                </span> 
                {dictionary[part]} 
              </span> 
            </span> 
          ); 
        } 
        return <span key={i} className="opacity-80">{part}</span>; 
      }); 
    } catch (e) { 
      return <span className="opacity-80">{rawContent}</span>; 
    } 
  }; 

  return ( 
    <div className="bg-black border border-zinc-900 rounded-sm overflow-hidden shadow-2xl h-full flex flex-col"> 
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
      
      {/* 限制最大高度并允许内部滚动，配合外层的 sticky 达到绝佳体验 */} 
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
  ); 
}
