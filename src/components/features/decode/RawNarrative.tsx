"use client";
import React from 'react';
import { FileText, Cpu } from 'lucide-react';

interface RawNarrativeProps {
  rawContent: string;
  fluffWords: any;
  lang?: 'cn' | 'en';
}

export default function RawNarrative({ rawContent, fluffWords, lang = 'cn' }: RawNarrativeProps) {
  const renderRawText = () => {
    if (!rawContent) return null;
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
  };

  return (
    <div className="bg-black border border-zinc-900 rounded-sm overflow-hidden shadow-2xl">
      <div className="bg-zinc-900/30 px-6 py-3 border-b border-zinc-900 flex items-center justify-between">
         <div className="flex items-center gap-3">
            <FileText size={14} className="text-zinc-500" />
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Evidence_File_Raw.txt</span>
         </div>
         <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
            <span className="text-[9px] font-mono text-red-900">DECODED_VIEW</span>
         </div>
      </div>
      
      <div className="p-10 md:p-16 relative">
        {/* 背景装饰 */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] z-10 pointer-events-none bg-[length:100%_4px,3px_100%]" />
        
        <div className="relative z-20 font-serif text-lg leading-[1.8] text-zinc-500 tracking-wide text-justify">
          {renderRawText()}
        </div>
      </div>

      <div className="bg-zinc-900/10 px-6 py-4 border-t border-zinc-900 flex justify-between items-center font-mono text-[8px] text-zinc-700">
         <span>SHA-256: 8f92b...d3e1</span>
         <span>SECURITY LEVEL: CLASSIFIED</span>
      </div>
    </div>
  );
}