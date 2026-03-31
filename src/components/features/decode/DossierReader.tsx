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
        const cleanText = part.slice(2, -2);
        return <strong key={`${prefixKey}-bold-${i}`} className="text-white font-black">{cleanText}</strong>;
      }
      return <span key={`${prefixKey}-text-${i}`}>{part}</span>;
    });
  };

  // 🚀 核心修复：采用跨行正则，解决内容过长导致的气泡结构撕裂
  const parseInlineFormat = (text: string) => {
    const tagRegex = /\[\[([\s\S]*?)(?:::|：：)([\s\S]*?)\]\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    while ((match = tagRegex.exec(text)) !== null) {
      if (match.index > lastIndex) parts.push(...parseBoldAndDict(text.slice(lastIndex, match.index), `chunk-${match.index}`));
      const surfaceWord = match[1].trim();
      const deepInsight = match[2].trim();
      parts.push(
        <span key={`tag-${match.index}`} onMouseEnter={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setHoverInfo({ text: deepInsight, x: rect.left + rect.width / 2, y: rect.top });
          }} onMouseLeave={() => setHoverInfo(null)} className="text-red-400 border-b border-red-500 bg-red-950/30 hover:bg-red-900/60 transition-all px-1 rounded-sm cursor-help font-bold"
        >{surfaceWord}</span>
      );
      lastIndex = tagRegex.lastIndex;
    }
    if (lastIndex < text.length) parts.push(...parseBoldAndDict(text.slice(lastIndex), 'last-chunk'));
    return parts;
  };

  const renderBlocks = () => {
    return content.split(/\n+/).map((block, index) => {
      const trimmed = block.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith('# ')) return <h3 key={index} className="text-xl font-black text-white mt-12 mb-6 border-l-4 border-red-700 pl-4 bg-gradient-to-r from-red-950/20 py-2">{parseInlineFormat(trimmed.replace(/^#+\s*/, ''))}</h3>;
      return <p key={index} className="text-zinc-400 font-serif leading-[2] mb-6 text-justify">{parseInlineFormat(trimmed)}</p>;
    });
  };

  return (
    <>
      <div className="bg-[#050505] border border-zinc-900 rounded-sm relative overflow-hidden shadow-2xl">
        <div className="bg-zinc-950/80 px-8 py-5 border-b border-zinc-900 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-4"><BookOpen className="text-red-700" size={20} /><div><h2 className="text-sm font-black text-white uppercase tracking-[0.3em]">Shadow Dossier</h2></div></div>
        </div>
        <div ref={containerRef} className="p-8 md:p-14 max-h-[800px] overflow-y-auto scrollbar-thin relative">
          <div className="relative z-10 max-w-4xl mx-auto">{renderBlocks()}{isStreaming && <span className="inline-block w-3 h-6 bg-red-700 animate-pulse ml-2" />}</div>
        </div>
      </div>
      {hoverInfo && (
        <div className="fixed z-[9999] w-max max-w-[280px] bg-black border border-red-900 text-zinc-300 text-xs p-4 rounded-sm shadow-[0_0_40px_rgba(185,28,28,0.8)] pointer-events-none transform -translate-x-1/2 -translate-y-full leading-relaxed" style={{ left: hoverInfo.x, top: hoverInfo.y - 10 }}>
          <span className="text-red-500 flex items-center gap-2 mb-2 font-mono uppercase font-bold border-b border-red-900/50 pb-2"><Zap size={12} /> 深层剖析</span>
          {hoverInfo.text}
        </div>
      )}
    </>
  );
}