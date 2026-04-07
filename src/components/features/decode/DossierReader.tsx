"use client";
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { BookOpen, ShieldAlert, Zap, AlertTriangle } from 'lucide-react';

export default function DossierReader({ 
  content, 
  isStreaming = false, 
  isTranslating = false,
  isTruncated = false,
  qualityError = null,
  recoveryHint = null,
  lang = 'cn',
}: { 
  content: string; 
  isStreaming?: boolean; 
  isTranslating?: boolean;
  isTruncated?: boolean;
  /** 流式输出质量异常（如异常复读被掐断）时的说明文案 */
  qualityError?: string | null;
  /** 自动恢复过程中性提示（重试、切换通道等） */
  recoveryHint?: string | null;
  /** 当前界面语言，控制组件内部 UI 文案 */
  lang?: 'cn' | 'en';
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverInfo, setHoverInfo] = useState<{ text: string, x: number, y: number, isAbove: boolean } | null>(null);
  const [mounted] = useState(() => typeof window !== 'undefined');

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
        return <strong key={`${prefixKey}-bold-${i}`} className="text-zinc-900 font-black">{part.slice(2, -2)}</strong>;
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
            className="bg-red-100 text-red-800 px-1.5 rounded-[2px] border-b border-red-300 transition-all duration-300 hover:bg-red-200 hover:text-red-950 hover:shadow-sm cursor-crosshair font-bold"
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
          <h3 key={`heading-${index}`} className="text-xl md:text-2xl font-semibold text-zinc-950 tracking-tight mt-12 mb-6 border-l-4 border-red-600 pl-4 bg-gradient-to-r from-red-50 to-transparent py-2 block">
            {parseInlineFormat(cleanTitle, index)}
          </h3>
        );
      }
      
      // 捕获 Markdown 列表
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const cleanListItem = trimmed.replace(/^[-*]\s*/, '');
        return (
            <div key={`list-${index}`} className="flex items-start gap-4 my-3 pl-4">
            <span className="text-red-600 mt-1.5 shrink-0">✦</span>
            <div className="text-zinc-700 font-serif leading-[2.2] tracking-wide text-base md:text-lg w-full">
              {parseInlineFormat(cleanListItem, index)}
            </div>
          </div>
        );
      }

      // 🛡️ 防御性渲染守卫：检测并跳过孤立注脚块
      // 当 AI 将 [[Term::Analysis]] 抽离为底部列表时，每行只有一个注脚标记，
      // 去掉所有 [[...]] 内容后剩余正文为空，此时跳过渲染，避免产生无上下文的孤立红字行。
      // 此守卫不影响正常内联注脚（正常情况下注脚前后有正文，stripped 后仍有内容）。
      if (trimmed.startsWith('[[') && trimmed.endsWith(']]')) {
        const strippedOfFootnotes = trimmed.replace(/\[\[[\s\S]*?\]\]/g, '').trim();
        if (strippedOfFootnotes.length === 0) {
          return null;
        }
      }

      // 常规段落渲染
      return (
        <p key={`p-${index}`} className="text-zinc-800 font-sans leading-relaxed text-base md:text-lg mb-6 text-justify max-w-prose">
          {parseInlineFormat(trimmed, index)}
        </p>
      );
    });
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-[var(--td-surface-1)] border border-[var(--td-border)] rounded-lg relative overflow-hidden shadow-sm ring-1 ring-[var(--td-ring)] flex flex-col h-full">
        <div className="bg-zinc-50 px-8 py-5 border-b border-[var(--td-border)] flex items-center justify-between sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <BookOpen className="text-red-600" size={20} />
            <div>
              <h2 className="text-sm font-semibold text-zinc-950 tracking-tight">Shadow dossier</h2>
              <p className="text-[10px] font-mono text-zinc-600 mt-1 uppercase tracking-widest">Top secret · Analysis</p>
            </div>
          </div>
          {isStreaming || isTranslating ? ( 
            <span className="flex items-center gap-2 text-[10px] font-mono text-red-700 uppercase bg-red-50 px-3 py-1.5 rounded-md border border-red-200">
              <span className="w-1.5 h-1.5 bg-red-600 rounded-full animate-ping" />
              {isTranslating ? (lang === 'cn' ? '正在翻译...' : 'Translating...') : 'Intercepting...'}
            </span> 
          ) : ( 
            <span className="text-[10px] font-mono text-zinc-500 uppercase flex items-center gap-2">
              <ShieldAlert size={12} />Decoded
            </span> 
          )}
        </div>

        <div ref={containerRef} className="p-8 md:p-14 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-300 relative flex-1 bg-white">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04]">
            <ShieldAlert className="w-[500px] h-[500px] text-zinc-300" />
          </div>
          <div className="relative z-10 max-w-4xl mx-auto">
            {isStreaming && recoveryHint && (
              <div className="mb-8 p-4 border border-zinc-200 bg-zinc-50 rounded-md">
                <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest leading-relaxed">
                  {recoveryHint}
                </p>
              </div>
            )}
            {renderBlocks()}
            
            {isStreaming && (
              <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="inline-block w-3 h-6 bg-red-600 ml-2 align-middle rounded-sm"/>
            )}
            
            {/* 🚨 架构师防线：UI 级截断托底 */}
            {!isStreaming && qualityError && (
              <div className="mt-12 p-6 border border-amber-200 bg-amber-50 rounded-md flex items-start gap-4">
                <AlertTriangle className="text-amber-600 shrink-0 w-6 h-6 mt-1" />
                <div>
                  <h4 className="text-amber-800 font-bold uppercase tracking-widest text-sm mb-2">{lang === 'cn' ? 'Output Quality Guard / 输出质量拦截' : 'OUTPUT QUALITY GUARD'}</h4>
                  <p className="text-amber-900/90 text-sm leading-relaxed font-mono">
                    {qualityError}
                  </p>
                </div>
              </div>
            )}

            {!isStreaming && isTruncated && !qualityError && (
              <div className="mt-12 p-6 border border-red-200 bg-red-50 rounded-md flex items-start gap-4">
                <AlertTriangle className="text-red-600 shrink-0 w-6 h-6 mt-1" />
                <div>
                  <h4 className="text-red-800 font-bold uppercase tracking-widest text-sm mb-2">{lang === 'cn' ? 'Signal Truncated / 卷宗截断预警' : 'SIGNAL TRUNCATED'}</h4>
                  <p className="text-red-900/85 text-sm leading-relaxed font-mono">
                    {lang === 'cn'
                      ? '探测到云端算力限制或网络波动，底层逻辑链条未能完全闭环。尾部推演数据已永久丢失。请结合已呈现的前置逻辑自行推断，或使用下方的 PRO 终端继续追问。'
                      : 'Cloud compute limit or network disruption detected. The tail-end inference chain is permanently lost. Refer to the existing analysis above, or continue with the PRO Terminal below.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
      
      {mounted && hoverInfo && createPortal(
        <div
          className={`fixed z-[2147483647] w-max max-w-[320px] bg-white/95 backdrop-blur-xl border border-red-200 text-zinc-800 text-sm p-5 rounded-lg shadow-lg pointer-events-none transition-all duration-150 font-sans leading-relaxed ${hoverInfo.isAbove ? 'transform -translate-x-1/2 -translate-y-full' : 'transform -translate-x-1/2'}`}
          style={{ left: hoverInfo.x, top: hoverInfo.y }}
        >
          <span className="text-red-600 flex items-center gap-2 mb-3 font-mono uppercase tracking-widest font-black border-b border-red-100 pb-2 text-xs">
             <Zap size={14} className="animate-pulse" /> DEEP INSIGHT
          </span>
          <div className="text-justify whitespace-pre-wrap">{hoverInfo.text}</div>
        </div>,
        document.body
      )}
    </>
  );
}