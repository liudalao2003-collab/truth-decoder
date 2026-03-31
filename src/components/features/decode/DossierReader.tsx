"use client";
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, ShieldAlert, Zap } from 'lucide-react';

export default function DossierReader({ content, isStreaming = false, dictionary = {} }: { content: string, isStreaming?: boolean, dictionary?: Record<string, string> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverInfo, setHoverInfo] = useState<{ text: string, x: number, y: number } | null>(null);

  useEffect(() => {
    if (isStreaming && containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [content, isStreaming]);

  const parseBoldAndDict = (text: string, prefixKey: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={`${prefixKey}-bold-${i}`} className="text-white font-black">{part.slice(2, -2)}</strong>;
      }
      return <span key={`${prefixKey}-text-${i}`}>{part}</span>;
    });
  };

  const parseInlineFormat = (text: string) => {
    // 支持跨行，且增加对不规则空格的包容性
    const tagRegex = /\[\[\s*([\s\S]*?)\s*(?:::|：：)\s*([\s\S]*?)\s*\]\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = tagRegex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(...parseBoldAndDict(text.slice(lastIndex, match.index), `chunk-${match.index}`));
      
      const surfaceWord = match[1].replace(/\]$/g, '').trim();
      const deepInsight = match[2].trim();
      
      parts.push(
        <span key={`tag-${match.index}`} onMouseEnter={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const safeX = Math.max(150, Math.min(window.innerWidth - 150, rect.left + rect.width / 2));
            setHoverInfo({ text: deepInsight, x: safeX, y: rect.top });
          }} onMouseLeave={() => setHoverInfo(null)} className="text-red-400 border-b border-red-500 bg-red-950/30 hover:bg-red-900/60 transition-all duration-300 pb-0.5 px-1 rounded-sm cursor-help font-bold"
        >{surfaceWord}</span>
      );
      lastIndex = tagRegex.lastIndex;
    }
    if (lastIndex < text.length) parts.push(...parseBoldAndDict(text.slice(lastIndex), 'last-chunk'));
    return parts;
  };

  const renderBlocks = () => {
    // 🚨 V6.5 渲染容灾抢救：大模型如果漏掉了 [[ ]]，但写了 词汇::【，前端自动为其补全双括号！
    let safeContent = content;
    safeContent = safeContent.replace(/(?<!\[)\[([^\[\]]+?(?:::|：：)[\s\S]+?)\](?!\])/g, '[[$1]]'); // 修复单括号 [词汇::解释] -> [[词汇::解释]]
    // 修复完全没括号，直接 词汇::【解释】 的极端情况（针对图2死因）
    safeContent = safeContent.replace(/([^\s\[]+?)(?:::|：：)(\s*[【\[][\s\S]+?(?:。|\]|\n\n))/g, '[[$1::$2]]');

    return safeContent.split(/\n+/).map((block, index) => {
      const trimmed = block.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith('# ') || trimmed.startsWith('## ')) {
        return (
          <h3 key={index} className="text-xl md:text-2xl font-black text-white tracking-wider uppercase mt-12 mb-6 border-l-4 border-red-700 pl-4 bg-gradient-to-r from-red-950/20 py-2 block">
            {parseInlineFormat(trimmed.replace(/^#+\s*/, ''))}
          </h3>
        );
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <div key={index} className="flex items-start gap-4 my-3 pl-4">
            <span className="text-red-700 mt-1.5 shrink-0">✦</span>
            <div className="text-zinc-400 font-serif leading-relaxed text-base md:text-lg">{parseInlineFormat(trimmed.replace(/^[-*]\s*/, ''))}</div>
          </div>
        );
      }
      return <p key={index} className="text-zinc-400 font-serif leading-[2] tracking-wide text-base md:text-lg mb-6 text-justify">{parseInlineFormat(trimmed)}</p>;
    });
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#050505] border border-zinc-900 rounded-sm relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <div className="bg-zinc-950/80 px-8 py-5 border-b border-zinc-900 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-4"><BookOpen className="text-red-700" size={20} /><div><h2 className="text-sm font-black text-white uppercase tracking-[0.3em]">Shadow Dossier</h2><p className="text-[10px] font-mono text-zinc-600 mt-1 uppercase">Top Secret // Analysis</p></div></div>
          {isStreaming ? ( <span className="flex items-center gap-2 text-[10px] font-mono text-red-500 uppercase bg-red-950/30 px-3 py-1.5 rounded-sm border border-red-900/50"><span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />Intercepting...</span> ) : ( <span className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-2"><ShieldAlert size={12} />Decoded</span> )}
        </div>
        <div ref={containerRef} className="p-8 md:p-14 max-h-[800px] overflow-y-auto scrollbar-thin relative">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02]"><ShieldAlert className="w-[500px] h-[500px] text-white" /></div>
          <div className="relative z-10 max-w-4xl mx-auto">{renderBlocks()}{isStreaming && <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="inline-block w-3 h-6 bg-red-700 ml-2 align-middle"/>}</div>
        </div>
      </motion.div>
      {hoverInfo && (
        <div className="fixed z-[9999] w-max max-w-[280px] bg-black border border-red-900 text-zinc-300 text-xs p-4 rounded-sm shadow-[0_0_40px_rgba(185,28,28,0.8)] pointer-events-none transform -translate-x-1/2 -translate-y-full leading-relaxed transition-all duration-75" style={{ left: hoverInfo.x, top: hoverInfo.y - 10 }}>
          <span className="text-red-500 flex items-center gap-2 mb-2 font-mono uppercase tracking-widest font-bold border-b border-red-900/50 pb-2"><Zap size={12} /> 深层剖析 (Deep Insight)</span>
          {hoverInfo.text}
        </div>
      )}
    </>
  );
}