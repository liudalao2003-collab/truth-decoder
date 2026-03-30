"use client";
import { motion, Variants } from 'framer-motion'; // 🛡️ 引入契约
import { Target } from 'lucide-react';

interface VerdictPanelProps {
  verdict: string;
  isErased: boolean;
}

export default function VerdictPanel({ verdict, isErased }: VerdictPanelProps) {
  // 🚀 核心修复：锁定 Variants 类型
  const digitalRainVariants: Variants = {
    hidden: { 
        opacity: 0, 
        y: -100, 
        filter: "blur(15px)", 
        color: '#dc2626',
        textShadow: "0 0 10px rgba(220, 38, 38, 1)"
    },
    visible: { 
      opacity: 1, 
      y: 0, 
      filter: "blur(0px)",
      color: '#ffffff',
      textShadow: "0 0 0px rgba(220, 38, 38, 0)",
      transition: { 
        delay: 2.2, 
        duration: 1.2,
        ease: [0.17, 0.67, 0.83, 0.67] 
      } 
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={isErased ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
      transition={{ delay: 1.8, duration: 1 }}
      className="bg-black border border-zinc-900 border-t-4 border-t-red-900 p-10 md:p-16 rounded-sm relative overflow-hidden shadow-[0_-20px_100px_rgba(220,38,38,0.1)] selection:bg-red-950 selection:text-white"
    >
      <Target className="absolute -right-20 -top-20 w-80 h-80 text-red-950 pointer-events-none" />
      <div className="relative z-10 max-w-4xl">
        <span className="text-xs font-black uppercase tracking-[0.4em] text-red-700 block mb-8">FINAL VERDICT / 最终判决</span>
        <motion.p 
            variants={digitalRainVariants}
            className="text-4xl md:text-5xl font-black tracking-tighter leading-none italic"
        >
          “{verdict}”
        </motion.p>
      </div>
    </motion.div>
  );
}