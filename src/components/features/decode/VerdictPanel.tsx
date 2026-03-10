import { motion } from 'framer-motion';
import { Target } from 'lucide-react';

interface VerdictPanelProps {
  verdict: string;
  isErased: boolean;
}

export default function VerdictPanel({ verdict, isErased }: VerdictPanelProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={isErased ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ delay: 2, duration: 1 }}
      className="bg-zinc-900/20 border border-zinc-800 border-t-4 border-t-red-700 p-10 md:p-16 rounded-sm relative overflow-hidden shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
    >
      <Target className="absolute -right-20 -top-20 w-80 h-80 text-red-900/5 pointer-events-none" />
      <div className="relative z-10 max-w-4xl">
        <span className="text-xs font-black uppercase tracking-[0.4em] text-red-600 block mb-8">FINAL VERDICT / 最终判决</span>
        <p className="text-4xl md:text-5xl font-black tracking-tighter leading-none text-white italic">
          “{verdict}”
        </p>
      </div>
    </motion.div>
  );
}