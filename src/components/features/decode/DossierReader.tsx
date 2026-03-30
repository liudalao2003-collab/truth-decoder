"use client";
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, ShieldAlert, Zap } from 'lucide-react';

interface DossierReaderProps {
  content: string; 
  isStreaming?: boolean; 
  dictionary?: Record<string, string>;
}

const DecodedText = ({ text, dictionary, setHover }: { text: string, dictionary?: Record<string, string>, setHover: (info: {text: string, x: number, y: number} | null) => void }) => { 
   if (!dictionary || Object.keys(dictionary).length === 0) return <>{text}</>; 
   const keys = Object.keys(dictionary).filter(k => k.trim() !== ''); 
   if (keys.length === 0) return <>{text}</>; 
   
   let mappedParts: React.ReactNode[] = []; 
   try { 
     const regex = new RegExp(`(${keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g'); 
     const parts = text.split(regex); 
     
     // 🚀 架构师修复：将 JSX 映射计算完毕后，再进行 return，杜绝 try/catch 污染 React 渲染流 
     mappedParts = parts.map((part, i) => { 
       if (dictionary[part]) { 
         return ( 
           <span 
             key={i} 
             onMouseEnter={(e) => { 
               const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); 
               const safeX = Math.max(150, Math.min(window.innerWidth - 150, rect.left + rect.width / 2)); 
               setHover({ text: dictionary[part], x: safeX, y: rect.top }); 
             }} 
             onMouseLeave={() => setHover(null)} 
             className="text-red-400 border-b border-red-500/50 bg-red-950/20 hover:bg-red-900/50 transition-all duration-300 pb-0.5 px-1 rounded-sm cursor-help" 
           > 
             {part} 
           </span> 
         ); 
       } 
       return <span key={i}>{part}</span>; 
     }); 
   } catch (_e) { 
     return <>{text}</>; 
   } 
   
   return <>{mappedParts}</>; 
 };

export default function DossierReader({ content, isStreaming = false, dictionary = {} }: DossierReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverInfo, setHoverInfo] = useState<{ text: string, x: number, y: number } | null>(null);

  useEffect(() => {
    if (isStreaming && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  // 🚨 核心超载：支持处理原版加粗 + 独创的 [[词汇::注脚]] 语法 \n   const parseInlineFormat = (text: string) => { \n     // 🚀 核心修复 2：使用 [\\s\\S]*? 强行跨越多行回车匹配，兼容中文全角冒号 \n     const tagRegex = /\[\[([\\s\\S]*?)(?:::|：：)([\\s\\S]*?)\]\]/g; \n     const parts: React.ReactNode[] = []; \n     let lastIndex = 0; \n     let match; \n     let chunkCounter = 0; \n \n     // 第一层：解析大模型特供的 [[词汇::深度注脚]] 语法 \n     while ((match = tagRegex.exec(text)) !== null) { \n       if (match.index > lastIndex) { \n         const beforeText = text.slice(lastIndex, match.index); \n         parts.push(...parseBoldAndDict(beforeText, `chunk-${chunkCounter++}`)); \n       } \n       \n       const surfaceWord = match[1].trim(); \n       const deepInsight = match[2].trim(); \n \n       // 渲染高密度专属气泡 \n       parts.push( \n         <span \n           key={`tag-${match.index}`} \n           onMouseEnter={(e) => { \n             const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); \n             const safeX = Math.max(150, Math.min(window.innerWidth - 150, rect.left + rect.width / 2)); \n             setHoverInfo({ text: deepInsight, x: safeX, y: rect.top }); \n           }} \n           onMouseLeave={() => setHoverInfo(null)} \n           className=\"text-red-400 border-b border-red-500 bg-red-950/30 hover:bg-red-900/60 transition-all duration-300 pb-0.5 px-1 rounded-sm cursor-help shadow-[0_0_10px_rgba(220,38,38,0.2)] font-bold\" \n         > \n           {surfaceWord} \n         </span> \n       ); \n       lastIndex = tagRegex.lastIndex; \n     } \n \n     if (lastIndex < text.length) { \n       parts.push(...parseBoldAndDict(text.slice(lastIndex), `chunk-${chunkCounter++}`)); \n     } \n     return parts; \n   };

  // 第二层：常规加粗和全局词典探测，强制接收 prefixKey
  const parseBoldAndDict = (text: string, prefixKey: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const cleanText = part.slice(2, -2);
        return <strong key={`${prefixKey}-bold-${i}`} className="text-white font-black"><DecodedText text={cleanText} dictionary={dictionary} setHover={setHoverInfo} /></strong>;
      }
      return <DecodedText key={`${prefixKey}-text-${i}`} text={part} dictionary={dictionary} setHover={setHoverInfo} />;
    });
  };

  const renderBlocks = () => {
    if (!content) return null;
    
    const blocks = content.split(/\n+/);
    return blocks.map((block, index) => {
      const trimmed = block.trim();
      if (!trimmed) return null;

      if (trimmed.startsWith('# ') || trimmed.startsWith('## ')) {
        const titleText = trimmed.replace(/^#+\s*/, '');
        return (
          <h3 key={`heading-${index}`} className="text-xl md:text-2xl font-black text-white tracking-wider uppercase mt-12 mb-6 border-l-4 border-red-700 pl-4 bg-gradient-to-r from-red-950/20 to-transparent py-2 block">
            {parseInlineFormat(titleText)}
          </h3>
        );
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const cleanItem = trimmed.replace(/^[-*]\s*/, '');
        return (
          <div key={`list-${index}`} className="flex items-start gap-4 my-3 pl-4">
            <span className="text-red-700 mt-1.5 shrink-0">✦</span>
            <div className="text-zinc-400 font-serif leading-relaxed text-base md:text-lg">
              {parseInlineFormat(cleanItem)}
            </div>
          </div>
        );
      }

      return (
        <p key={`p-${index}`} className="text-zinc-400 font-serif leading-[2] tracking-wide text-base md:text-lg mb-6 text-justify">
          {parseInlineFormat(trimmed)}
        </p>
      );
    });
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#050505] border border-zinc-900 rounded-sm relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <div className="bg-zinc-950/80 px-8 py-5 border-b border-zinc-900 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <BookOpen className="text-red-700" size={20} />
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-[0.3em]">Shadow Dossier</h2>
              <p className="text-[10px] font-mono text-zinc-600 mt-1 tracking-widest">TOP SECRET // CROSS-DOMAIN ANALYSIS</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {isStreaming ? (
              <span className="flex items-center gap-2 text-[10px] font-mono text-red-500 uppercase tracking-widest bg-red-950/30 px-3 py-1.5 rounded-sm border border-red-900/50">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />Intercepting...
              </span>
            ) : (
              <span className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
                <ShieldAlert size={12} className="text-zinc-500" />Decoded & Locked
              </span>
            )}
          </div>
        </div>

        <div ref={containerRef} className="p-8 md:p-14 max-h-[800px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent relative">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02]">
             <ShieldAlert className="w-[500px] h-[500px] text-white" />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto">
            {renderBlocks()}
            {isStreaming && (
              <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="inline-block w-3 h-6 bg-red-700 ml-2 align-middle"/>
            )}
          </div>
        </div>
      </motion.div>

      {/* 🚀 逃逸渲染层：暗影注脚专属呈现 */}
      {hoverInfo && (
        <div
          className="fixed z-[9999] w-max max-w-[280px] bg-black border border-red-900 text-zinc-300 text-xs p-4 rounded-sm shadow-[0_0_40px_rgba(185,28,28,0.8)] pointer-events-none transform -translate-x-1/2 -translate-y-full leading-relaxed text-left font-sans transition-all duration-75"
          style={{ left: hoverInfo.x, top: hoverInfo.y - 10 }}
        >
          <span className="text-red-500 flex items-center gap-2 mb-2 font-mono uppercase tracking-widest font-bold border-b border-red-900/50 pb-2">
            <Zap size={12} /> 深层剖析 (Deep Insight)
          </span>
          {hoverInfo.text}
        </div>
      )}
    </>
  );
}