"use client";
import { motion, AnimatePresence, Variants } from 'framer-motion'; // 🛡️ 引入 Variants 类型契约
import { Zap, EyeOff, CheckSquare } from 'lucide-react';
import { i18n } from '@/config/i18n';

interface HardFactsProps {
  hardFacts: string[];
  isErased: boolean;
  onErase: () => void;
}

export default function HardFacts({ hardFacts, isErased, onErase }: HardFactsProps) {
  // 🚀 核心修复：显式锁定 Variants 类型，防止 ease 数组被误判为普通 number[]
  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 100, filter: "blur(10px)" },
    visible: { 
      opacity: 1, 
      y: 0, 
      filter: "blur(0px)",
      transition: { 
        duration: 0.8,
        ease: [0.17, 0.67, 0.83, 0.67], // 现在受到 Variants 契约保护
        staggerChildren: 0.2 
      } 
    }
  };

  const factVariants: Variants = {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.7 } }
  };

  return (
    <motion.div 
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="bg-black border border-zinc-900 border-l-4 border-l-red-900 rounded-sm relative overflow-hidden flex flex-col shadow-[0_0_50px_rgba(239,68,68,0.05)] selection:bg-red-950 selection:text-white"
    >
      <AnimatePresence>
        {!isErased && (
          <motion.div 
            exit={{ opacity: 0, filter: "blur(20px)" }}
            className="absolute inset-0 z-10 bg-black flex flex-col items-center justify-center p-8 text-center"
          >
            <EyeOff className="w-16 h-16 text-red-900 mb-6 opacity-40" />
            <h3 className="text-2xl font-black uppercase text-white mb-4 tracking-[0.2em]">滤镜检测完成</h3>
            <p className="text-zinc-500 font-serif mb-10 max-w-sm text-sm">点击执行物理级数据剔除，同步底层利益逻辑。</p>
            <button onClick={onErase} className="group relative bg-red-700 hover:bg-red-600 text-white px-10 py-5 text-xl font-black tracking-widest uppercase transition-all rounded-sm overflow-hidden shadow-[0_0_30px_rgba(185,28,28,0.3)]">
              <span className="relative z-10 flex items-center gap-4">
                <Zap size={24} className="group-hover:animate-bounce" />
                {i18n.decode.eraseButton}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4 border-b border-zinc-900 bg-zinc-950 flex items-center gap-3">
        <CheckSquare className="w-4 h-4 text-red-700" />
        <span className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-300">{i18n.decode.factTitle}</span>
      </div>
      
      <div className="p-8 flex-1 flex flex-col justify-center gap-12 h-[550px]">
        {hardFacts.map((fact, index) => (
          <motion.div 
            key={index}
            variants={factVariants}
            className="flex gap-6 items-start group"
          >
            <span className="text-6xl font-black text-zinc-900 group-hover:text-red-950 transition-colors font-mono select-none -translate-y-2">0{index + 1}</span>
            <div className="flex-1 space-y-3">
                <p className="text-2xl font-bold leading-tight text-white tracking-tight">{fact}</p>
                <motion.div 
                    initial={{ width: "0%" }}
                    animate={isErased ? { width: "100%" } : { width: "0%" }}
                    transition={{ delay: index * 0.4 + 0.6, duration: 1 }}
                    className="h-[1px] bg-red-800 rounded-sm"
                />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}