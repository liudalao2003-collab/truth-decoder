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
            initial={{ backgroundColor: 'rgba(153,27,27,0.2)', color: '#f87171' }}
            animate={
              isErased 
                ? { textDecoration: 'line-through', opacity: 0.3, color: '#ef4444', backgroundColor: 'rgba(153,27,27,0)' } 
                : { backgroundColor: 'rgba(153,27,27,0.2)', color: '#f87171' }
            }
            transition={{ duration: 0.8, ease: "easeInOut" }}
            className="px-1 mx-0.5 rounded-sm font-medium inline-block"
          >
            {part}
          </motion.span>
        );
      }
      return <span key={i} className="transition-opacity duration-700">{part}</span>;
    });
  };

  return (
    <div className="bg-zinc-900/30 border border-zinc-800 rounded-sm overflow-hidden flex flex-col shadow-inner">
      <div className="p-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center gap-3">
        <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
        <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">{i18n.decode.rawTitle}</span>
      </div>
      <div className="p-8 text-xl font-serif leading-loose text-zinc-300 h-[550px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800">
        {renderRawText()}
      </div>
    </div>
  );
}