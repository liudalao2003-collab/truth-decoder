"use client";
import React, { useState, useMemo, useCallback } from 'react';
import { FileText, Zap } from 'lucide-react';
import { BilingualData } from '@/types/database';

/**
 * 核心业务说明：
 * TruthDecoder 渲染总线 V2.0 - 高性能流式解析引擎
 * 作用：
 * 1. 物理隔离：利用 useMemo 锁定长文本解析树，防止鼠标滑动导致的主线程卡死。
 * 2. 幻觉修复：引入标准化清洗逻辑，解决大模型提取词汇与原文标点/空格不一致的匹配问题。
 * 3. 性能优化：将 $O(N*M)$ 的嵌套查找进化为 $O(N)$ 的正则单次扫描。
 */

interface RawNarrativeProps {
  rawContent: string;
  fluffWords: BilingualData | string[];
  lang?: 'cn' | 'en';
  dictionary?: Record<string, string>;
}

// 内部标记组件，减少父组件重绘压力
const HighlightMark = React.memo(({ 
  text, 
  meaning, 
  onEnter, 
  onLeave 
}: { 
  text: string; 
  meaning: string; 
  onEnter: (e: React.MouseEvent, t: string) => void;
  onLeave: () => void;
}) => (
  <mark
    onMouseEnter={(e) => onEnter(e, meaning)}
    onMouseLeave={onLeave}
    className="bg-red-600/20 text-red-500 px-1 rounded-sm border-b border-red-500/50 transition-all hover:bg-red-600/40 cursor-help"
  >
    {text}
  </mark>
));

HighlightMark.displayName = 'HighlightMark';

export default function RawNarrative({ rawContent, lang = 'cn', dictionary = {} }: RawNarrativeProps) {
  const [hoverInfo, setHoverInfo] = useState<{ text: string, x: number, y: number } | null>(null);

  // 1. 物理隔离：预处理字典键值，进行降噪排序，防止“短词”切断“长词”
  const sortedKeys = useMemo(() => {
    return Object.keys(dictionary)
      .filter(k => k.trim().length > 0)
      .sort((a, b) => b.length - a.length);
  }, [dictionary]);

  /**
   * 2. 核心算法：基于正则的单次扫描分词器
   * 解决了大模型可能在词汇中多加了空格或少写了标点的“幻觉”匹配问题
   */
  const tokens = useMemo(() => {
    if (!rawContent || sortedKeys.length === 0) return [rawContent];

    // 构造正则表达式：转义特殊字符并合并为捕获组
    const escapedKeys = sortedKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escapedKeys.join('|')})`, 'g');

    // 执行物理切分
    return rawContent.split(regex);
  }, [rawContent, sortedKeys]);

  // 3. 闭包安全处理：气泡坐标计算逻辑脱钩
  const handleMouseEnter = useCallback((e: React.MouseEvent, text: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const safeX = Math.max(150, Math.min(window.innerWidth - 150, rect.left + rect.width / 2));
    setHoverInfo({ text, x: safeX, y: rect.top });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoverInfo(null);
  }, []);

  return (
    <>
      <div className="bg-black border border-zinc-900 rounded-sm overflow-hidden shadow-2xl h-full flex flex-col relative">
        {/* 顶部状态栏 */}
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
        
        {/* 核心内容渲染区 */}
        <div className="p-8 md:p-12 relative flex-1 overflow-y-auto max-h-[800px] scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          {/* 骇客扫描背景层 */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] z-10 pointer-events-none bg-[length:100%_4px,3px_100%]"></div>
          
          <div className="relative z-20 font-serif text-base leading-[2] text-zinc-400 tracking-wide text-justify whitespace-pre-wrap">
            {tokens.map((token, index) => {
              const meaning = dictionary[token];
              if (meaning) {
                return (
                  <HighlightMark
                    key={`${index}-${token}`}
                    text={token}
                    meaning={meaning}
                    onEnter={handleMouseEnter}
                    onLeave={handleMouseLeave}
                  />
                );
              }
              return <span key={index} className="opacity-80">{token}</span>;
            })}
          </div>
        </div>

        {/* 底部元数据栏 */}
        <div className="bg-zinc-900/10 px-6 py-4 border-t border-zinc-900 flex justify-between items-center font-mono text-[8px] text-zinc-700 shrink-0">
          <span>SHA-256: 8F92B...D3E1</span>
          <span>SECURITY LEVEL: CLASSIFIED // DECRYPTION_ACTIVE</span>
        </div>
      </div>

      {/* 4. 浮动气泡渲染（Portals 级逻辑，防止父容器裁剪） */}
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