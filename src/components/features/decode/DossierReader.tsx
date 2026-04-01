"use client";
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { BookOpen, ShieldAlert, Zap, AlertTriangle } from 'lucide-react';

export default function DossierReader({ 
  content, 
  isStreaming = false, 
  isTruncated = false,
  dictionary = {} 
}: { 
  content: string; 
  isStreaming?: boolean; 
  isTruncated?: boolean;
  dictionary?: Record<string, string>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverInfo, setHoverInfo] = useState<{ text: string, x: number, y: number, isAbove: boolean } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (isStreaming && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  const handleMouseEnter = useCallback((e: React.MouseEvent, text: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const maxW = 320; 
    let safeX = rect.left + rect.width / 2;
    if (safeX - maxW / 2 < 20) safeX = maxW / 2 + 20;
    if (safeX + maxW / 2 > window.innerWidth - 20) safeX = window.innerWidth - maxW / 2 - 20;

    let safeY = rect.top - 10;
    let isAbove = true;
    if (safeY < 200) {
      safeY = rect.bottom + 10;
      isAbove = false;
    }
    setHoverInfo({ text, x: safeX, y: safeY, isAbove });
  }, []);

  const handleMouseLeave = useCallback(() => setHoverInfo(null), []);

  const parseBoldAndDict = (text: string, prefixKey: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={`${prefixKey}-bold-${i}`} className="text-white font-black">{part.slice(2, -2)}</strong>;
      }
      return <span key={`${prefixKey}-text-${i}`}>{part}</span>;
    });
  };

  // 🚨 架构师防御矩阵 V2.0：工业级栈式词法解析器 (Stack-based Tokenizer)
  // 彻底免疫大模型幻觉、半截断括号、缺失冒号等物理破坏
  const parseInlineFormat = (text: string, blockIndex: number) => {
    const tokens = [];
    let current = 0;

    while (current < text.length) {
      const startIdx = text.indexOf('[[', current);
      
      if (startIdx === -1) {
        // 没有更多的标记，将剩余文本推入
        tokens.push(...parseBoldAndDict(text.slice(current), `b${blockIndex}-chunk-${current}`));
        break;
      }

      // 推入 `[[` 之前的正常文本
      if (startIdx > current) {
        tokens.push(...parseBoldAndDict(text.slice(current, startIdx), `b${blockIndex}-chunk-${current}`));
      }

      const endIdx = text.indexOf(']]', startIdx + 2);
      
      if (endIdx === -1) {
        // 探测到物理截断：有开头没结尾，启动降级容灾，直接作为普通文本渲染
        tokens.push(...parseBoldAndDict(text.slice(startIdx), `b${blockIndex}-chunk-${startIdx}`));
        break;
      }

      // 成功捕获完整括号内容
      const innerContent = text.slice(startIdx + 2, endIdx);
      const separatorIdx = innerContent.indexOf('::') !== -1 ? innerContent.indexOf('::') : innerContent.indexOf('：：');

      if (separatorIdx !== -1) {
        // 标准格式：[[词汇::解析]]
        const surfaceWord = innerContent.slice(0, separatorIdx).trim();
        const deepInsight = innerContent.slice(separatorIdx + 2).trim();

        tokens.push(
          <span 
            key={`b${blockIndex}-tag-${startIdx}`} 
            onMouseEnter={(e) => handleMouseEnter(e, deepInsight)} 
            onMouseLeave={handleMouseLeave} 
            className="bg-red-900/40 text-red-400 px-1.5 rounded-[2px] border-b border-red-500/50 transition-all duration-300 hover:bg-red-800/80 hover:text-white hover:shadow-[0_0_10px_rgba(220,38,38,0.5)] cursor-crosshair font-bold"
          >
            {surfaceWord}
          </span>
        );
      } else {
        // 格式畸变：没有冒号。物理降级渲染。
        tokens.push(<span key={`b${blockIndex}-malformed-${startIdx}`}>[[{innerContent}]]</span>);
      }

      current = endIdx + 2;
    }

    return tokens;
  };

  // 🚨 物理流切割引擎，摒弃所有粗暴的 string.replace
  const renderBlocks = () => {
    // 强制过滤掉所有无意义的空行，防止 DOM 节点臃肿
    const blocks = content.split(/\n+/).filter(b => b.trim().length > 0);

    return blocks.map((block, index) => {
      const trimmed = block.trim();
      
      // 捕获 Markdown 标题
      if (trimmed.startsWith('# ') || trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
        const cleanTitle = trimmed.replace(/^#+\s*/, '');
        return (
          <h3 key={`heading-${index}`} className="text-xl md:text-2xl font-black text-white tracking-wider uppercase mt-12 mb-6 border-l-4 border-red-700 pl-4 bg-gradient-to-r from-red-950/20 py-2 block">
            {parseInlineFormat(cleanTitle, index)}
          </h3>
        );
      }
      
      // 捕获 Markdown 列表
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const cleanListItem = trimmed.replace(/^[-*]\s*/, '');
        return (
          <div key={`list-${index}`} className="flex items-start gap-4 my-3 pl-4">
            <span className="text-red-700 mt-1.5 shrink-0">✦</span>
            <div className="text-zinc-400 font-serif leading-[2.2] tracking-wide text-base md:text-lg w-full">
              {parseInlineFormat(cleanListItem, index)}
            </div>
          </div>
        );
      }
      
      // 常规段落渲染
      return (
        <p key={`p-${index}`} className="text-zinc-400 font-serif leading-[2.2] tracking-wide text-base md:text-lg mb-6 text-justify">
          {parseInlineFormat(trimmed, index)}
        </p>
      );
    });
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[#050505] border border-zinc-900 rounded-sm relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col h-full">
        <div className="bg-zinc-950/80 px-8 py-5 border-b border-zinc-900 flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <BookOpen className="text-red-700" size={20} />
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-[0.3em]">Shadow Dossier</h2>
              <p className="text-[10px] font-mono text-zinc-600 mt-1 uppercase">Top Secret // Analysis</p>
            </div>
          </div>
          {isStreaming ? ( 
            <span className="flex items-center gap-2 text-[10px] font-mono text-red-500 uppercase bg-red-950/30 px-3 py-1.5 rounded-sm border border-red-900/50">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />Intercepting...
            </span> 
          ) : ( 
            <span className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-2">
              <ShieldAlert size={12} />Decoded
            </span> 
          )}
        </div>

        <div ref={containerRef} className="p-8 md:p-14 overflow-y-auto scrollbar-thin relative flex-1">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.02]">
            <ShieldAlert className="w-[500px] h-[500px] text-white" />
          </div>
          <div className="relative z-10 max-w-4xl mx-auto">
            {renderBlocks()}
            
            {isStreaming && (
              <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="inline-block w-3 h-6 bg-red-700 ml-2 align-middle"/>
            )}
            
            {/* 🚨 架构师防线：UI 级截断托底 */}
            {!isStreaming && isTruncated && (
              <div className="mt-12 p-6 border border-red-900 bg-red-950/20 rounded-sm flex items-start gap-4">
                <AlertTriangle className="text-red-500 shrink-0 w-6 h-6 mt-1" />
                <div>
                  <h4 className="text-red-500 font-bold uppercase tracking-widest text-sm mb-2">Signal Truncated / 卷宗截断预警</h4>
                  <p className="text-red-400/80 text-sm leading-relaxed font-mono">
                    探测到云端算力限制或网络波动，底层逻辑链条未能完全闭环。尾部推演数据已永久丢失。请结合已呈现的前置逻辑自行推断，或使用下方的 PRO 终端继续追问。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
      
      {mounted && hoverInfo && createPortal(
        <div
          className={`fixed z-[2147483647] w-max max-w-[320px] bg-zinc-950/98 backdrop-blur-xl border border-red-900/80 text-zinc-300 text-sm p-5 rounded-md shadow-[0_20px_50px_-10px_rgba(220,38,38,0.5)] pointer-events-none transition-all duration-150 font-serif leading-relaxed ${hoverInfo.isAbove ? 'transform -translate-x-1/2 -translate-y-full' : 'transform -translate-x-1/2'}`}
          style={{ left: hoverInfo.x, top: hoverInfo.y }}
        >
          <span className="text-red-500 flex items-center gap-2 mb-3 font-mono uppercase tracking-widest font-black border-b border-red-900/40 pb-2 text-xs">
             <Zap size={14} className="animate-pulse" /> DEEP INSIGHT
          </span>
          <div className="text-justify whitespace-pre-wrap">{hoverInfo.text}</div>
        </div>,
        document.body
      )}
    </>
  );
}