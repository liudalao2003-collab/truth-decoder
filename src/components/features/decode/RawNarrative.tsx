"use client";
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Zap } from 'lucide-react';

interface RawNarrativeProps {
  rawContent: string;
  lang?: 'cn' | 'en';
  dictionary?: Record<string, string>;
}

const HighlightMark = React.memo(({ 
  text, meaning, onEnter, onLeave 
}: { 
  text: string; meaning: string; onEnter: (e: React.MouseEvent, t: string) => void; onLeave: () => void;
}) => (
  <mark
    onMouseEnter={(e) => onEnter(e, meaning)}
    onMouseLeave={onLeave}
    className="bg-red-900/40 text-red-400 px-1.5 rounded-[2px] border-b border-red-500/50 transition-all duration-300 hover:bg-red-800/80 hover:text-white hover:shadow-[0_0_10px_rgba(220,38,38,0.5)] cursor-crosshair font-bold"
  >
    {text}
  </mark>
));
HighlightMark.displayName = 'HighlightMark';

export default function RawNarrative({ rawContent, lang = 'cn', dictionary = {} }: RawNarrativeProps) {
  const [hoverInfo, setHoverInfo] = useState<{ text: string, x: number, y: number, isAbove: boolean } | null>(null);
  const [mounted, setMounted] = useState(false);
  
  // 🛡️ 架构师装甲：气泡防闪烁延迟锁，允许鼠标平滑移入气泡内部进行滚动
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => setMounted(true), []);

  const sortedKeys = useMemo(() => {
    return Object.keys(dictionary)
      .filter(k => k.trim().length > 0)
      .sort((a, b) => b.length - a.length);
  }, [dictionary]);

  const tokens = useMemo(() => {
    if (!rawContent || sortedKeys.length === 0) return [rawContent];
    const escapedKeys = sortedKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedKeys.join('|')})`, 'g');
    return rawContent.split(regex);
  }, [rawContent, sortedKeys]);

  /**
   * 🚨 架构师 V7.1：防溢出智能定位算法与交互桥梁
   */
  const handleMouseEnter = useCallback((e: React.MouseEvent, text: string) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const maxW = 420; // 物理扩容：从 320px 拉升至 420px，提供更宽广的阅读横截面
    
    let safeX = rect.left + rect.width / 2;
    if (safeX - maxW / 2 < 20) safeX = maxW / 2 + 20;
    if (safeX + maxW / 2 > window.innerWidth - 20) safeX = window.innerWidth - maxW / 2 - 20;

    let safeY = rect.top - 10;
    let isAbove = true;
    
    // Y 轴智能翻转：因为气泡内容可能极长，预留 350px 缓冲阈值
    if (safeY < 350) {
      safeY = rect.bottom + 10;
      isAbove = false;
    }

    setHoverInfo({ text, x: safeX, y: safeY, isAbove });
  }, []);

  const handleMouseLeave = useCallback(() => {
    // 赋予 150ms 的防闪烁桥梁时间，允许用户鼠标平滑滑入气泡内部
    hoverTimer.current = setTimeout(() => {
      setHoverInfo(null);
    }, 150);
  }, []);

  const handlePortalMouseEnter = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);

  const handlePortalMouseLeave = useCallback(() => {
    setHoverInfo(null);
  }, []);

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
            <span className="text-[9px] font-mono text-red-900 uppercase">Intercepted_Stream</span>
          </div>
        </div>
        
        <div className="p-8 md:p-12 relative flex-1 overflow-y-auto max-h-[800px] scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] z-10 pointer-events-none bg-[length:100%_4px,3px_100%]"></div>
          <div className="relative z-20 font-serif text-base leading-[2.2] text-zinc-400 tracking-wide text-justify whitespace-pre-wrap">
            {tokens.map((token, index) => {
              const meaning = dictionary[token];
              if (meaning) {
                return <HighlightMark key={`${index}-${token}`} text={token} meaning={meaning} onEnter={handleMouseEnter} onLeave={handleMouseLeave} />;
              }
              return <span key={index} className="opacity-80">{token}</span>;
            })}
          </div>
        </div>
      </div>

      {/* 🚨 架构师 V7.1 终极装甲：移除 pointer-events-none，注入 max-h 与暗黑滚动条，允许深度阅读。 */}
      {mounted && hoverInfo && createPortal(
        <div
          onMouseEnter={handlePortalMouseEnter}
          onMouseLeave={handlePortalMouseLeave}
          className={`fixed z-[2147483647] w-max max-w-[360px] md:max-w-[420px] max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-red-900/50 scrollbar-track-transparent bg-zinc-950/98 backdrop-blur-xl border border-red-900/80 text-zinc-300 text-sm p-5 rounded-md shadow-[0_20px_50px_-10px_rgba(220,38,38,0.5)] pointer-events-auto transition-all duration-150 font-serif leading-relaxed ${hoverInfo.isAbove ? 'transform -translate-x-1/2 -translate-y-full' : 'transform -translate-x-1/2'}`}
          style={{ left: hoverInfo.x, top: hoverInfo.y }}
        >
          <span className="text-red-500 flex items-center gap-2 mb-3 font-mono uppercase tracking-widest font-black border-b border-red-900/40 pb-2 text-xs sticky top-0 bg-zinc-950/90 py-1 z-10">
             <Zap size={14} className="animate-pulse" /> {lang === 'cn' ? '深层剖析 (DEEP INSIGHT)' : 'DEEP INSIGHT'}
          </span>
          <div className="text-justify whitespace-pre-wrap">{hoverInfo.text}</div>
        </div>,
        document.body
      )}
    </>
  );
}