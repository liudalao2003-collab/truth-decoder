import { motion, AnimatePresence } from 'framer-motion';
import { Zap, EyeOff, CheckSquare } from 'lucide-react';
import { i18n } from '@/config/i18n';

interface HardFactsProps {
  hardFacts: string[];
  isErased: boolean;
  onErase: () => void;
}

export default function HardFacts({ hardFacts, isErased, onErase }: HardFactsProps) {
  return (
    <div className="bg-zinc-950 border border-zinc-800 border-l-4 border-l-red-700 rounded-sm relative overflow-hidden flex flex-col shadow-2xl">
      <AnimatePresence>
        {!isErased && (
          <motion.div 
            exit={{ opacity: 0, filter: "blur(20px)" }}
            className="absolute inset-0 z-10 bg-zinc-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center"
          >
            <EyeOff className="w-16 h-16 text-red-900 mb-6 opacity-40" />
            <h3 className="text-2xl font-black uppercase text-white mb-4 tracking-[0.2em]">滤镜检测完成</h3>
            <p className="text-zinc-500 font-serif mb-10 max-w-sm text-sm">点击执行物理级数据剔除，同步底层利益逻辑。</p>
            <button onClick={onErase} className="group relative bg-red-700 hover:bg-red-600 text-white px-10 py-5 text-xl font-black tracking-widest uppercase transition-all rounded-sm overflow-hidden">
              <span className="relative z-10 flex items-center gap-4">
                <Zap size={24} className="group-hover:animate-bounce" />
                {i18n.decode.eraseButton}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 border-b border-zinc-800 bg-zinc-900/80 flex items-center gap-3">
        <CheckSquare className="w-4 h-4 text-red-600" />
        <span className="text-xs font-bold uppercase tracking-widest text-white">{i18n.decode.factTitle}</span>
      </div>
      
      <div className="p-8 flex-1 flex flex-col justify-center gap-12 h-[550px]">
        {hardFacts.map((fact, index) => (
          <motion.div 
            key={index}
            initial={{ opacity: 0, x: 20 }}
            animate={isErased ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
            transition={{ delay: index * 0.4 + 0.2, duration: 0.7 }}
            className="flex gap-6 items-start group"
          >
            <span className="text-5xl font-black text-zinc-900 group-hover:text-red-900/30 transition-colors font-mono select-none">0{index + 1}</span>
            <p className="text-2xl font-bold leading-tight text-white tracking-tight border-b border-zinc-900 pb-4 w-full">{fact}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}