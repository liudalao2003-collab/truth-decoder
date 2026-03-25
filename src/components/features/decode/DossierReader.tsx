"use client";
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, ShieldAlert, Zap } from 'lucide-react';

interface DossierReaderProps {
  content: string; 
  isStreaming?: boolean; 
  dictionary?: Record<string, string>; 
}

// 修改子组件：通过 props 接收 setHover 方法
const DecodedText = ({ text, dictionary, setHover }: { text: string, dictionary?: Record<string, string>, setHover: (info: {text: string, x: number, y: number} | null) => void }) => {
  if (!dictionary || Object.keys(dictionary).length === 0) return <>{text}</>;
  const keys = Object.keys(dictionary).filter(k => k.trim() !== '');
  if (keys.length === 0) return <>{text}</>;

  try {
    const regex = new RegExp(`(${keys.map(k => k.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')).join('|')})`, 'g');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, i) => {
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
        })}
      </>
    );
  } catch (e) {
    return <>{text}</>;
  }
};

export default function DossierReader({ content, isStreaming = false, dictionary = {} }: DossierReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverInfo, setHoverInfo] = useState<{ text: string, x: number, y: number } | null>(null);

  useEffect(() => {
    if (isStreaming && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  const parseInlineFormat = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        const cleanText = part.slice(2, -2);
        return <strong key={i} className="text-white font-black"><DecodedText text={cleanText} dictionary={dictionary} setHover={setHoverInfo} /></strong>;
      }
      return <DecodedText key={i} text={part} dictionary={dictionary} setHover={setHoverInfo} />;
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
          <h3 key={index} className="text-xl md:text-2xl font-black text-white tracking-wider uppercase mt-12 mb-6 border-l-4 border-red-700 pl-4 bg-gradient-to-r from-red-950/20 to-transparent py-2 block">
            {parseInlineFormat(titleText)}
          </h3>
        );
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const cleanItem = trimmed.replace(/^[-*]\s*/, '');
        return (
          <div key={index} className="flex items-start gap-4 my-3 pl-4">
            <span className="text-red-700 mt-1.5 shrink-0">✦</span>
            <div className="text-zinc-400 font-serif leading-relaxed text-base md:text-lg">
              {parseInlineFormat(cleanItem)}
            </div>
          </div>
        );
      }

      return (
        <p key={index} className="text-zinc-400 font-serif leading-[2] tracking-wide text-base md:text-lg mb-6 text-justify">
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
              <p className="text-[10px] font-mono text-zinc-600 mt-1 tracking-widest">TOP SECRET // EXECUTIVE SUMMARY</p>
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