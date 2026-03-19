"use client";
import { motion } from 'framer-motion';
import { i18n } from '@/config/i18n';

interface RawNarrativeProps {
  rawContent: string;
  fluffWords: string[];
  isErased: boolean;
}

export default function RawNarrative({ rawContent, fluffWords, isErased }: RawNarrativeProps) {
  const renderRawText = () => {
    if (!fluffWords || fluffWords.length === 0) return rawContent;
    const safeWords = fluffWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${safeWords.join('|')})`, 'g');
    const parts = rawContent.split(regex);
    
    return parts.map((part, i) => {
      if (fluffWords.includes(part)) {
        return (
          <motion.span
            key={i}
            initial={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', borderBottom: '1px solid rgba(220, 38, 38, 0.3)' }}
            animate={
              isErased 
                ? { 
                    backgroundColor: 'rgba(239, 68, 68, 0)', 
                    color: '#dc2626', 
                    borderBottom: '1px dashed rgba(220, 38, 38, 1)',
                    scale: 0.9,
                    filter: "blur(2px)",
                    opacity: 0.1
                  } 
                : { 
                    backgroundColor: 'rgba(239, 68, 68, 0.15)', 
                    color: '#fca5a5', 
                    borderBottom: '1px solid rgba(220, 38, 38, 0.3)'
                  }
            }
            // 🚨 駭客特效：物理电击剥离，配合 Glitch 效果
            transition={{ duration: 0.6, ease: [0.17, 0.67, 0.83, 0.67] }}
            className="px-0.5 mx-0.5 rounded-[1px] font-bold inline-block relative overflow-hidden"
          >
            {part}
            {/* 物理电击线 */}
            <motion.div 
              animate={isErased ? { x: "100%", opacity: [1, 0] } : { x: "-100%", opacity: [0, 1] }}
              transition={{ duration: 0.3 }}
              className="absolute inset-x-0 bottom-0 h-0.5 bg-red-600 rounded-sm"
            />
          </motion.span>
        );
      }
      return <span key={i} className="transition-all duration-700">{part}</span>;
    });
  };

  return (
    <div className="bg-zinc-950 border border-zinc-900 rounded-sm overflow-hidden flex flex-col shadow-[0_0_100px_rgba(185,28,28,0.01)]">
      <div className="p-4 border-b border-zinc-900 bg-zinc-950/80 flex items-center gap-3">
        <div className="w-2.5 h-2.5 bg-red-600 rounded-full animate-pulse" />
        <span className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-300">{i18n.decode.rawTitle}</span>
      </div>
      <div className="p-10 text-xl font-serif leading-loose text-zinc-300 h-[550px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-900 selection:bg-red-950 selection:text-white">
        {renderRawText()}
      </div>
    </div>
  );
}