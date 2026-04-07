"use client";
import { motion } from "framer-motion";
import { Scale } from "lucide-react";

interface VerdictPanelProps {
  verdict: string;
  isErased: boolean;
  /** 当前界面语言，控制组件内部 UI 文案 */
  lang?: 'cn' | 'en';
}

/**
 * 最终判决：可读性优先，短促入场动效，无长延迟模糊。
 */
export default function VerdictPanel({ verdict, isErased, lang = 'cn' }: VerdictPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.99 }}
      animate={isErased ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.99 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="bg-[var(--td-surface-1)] border border-[var(--td-border)] border-t-[3px] border-t-[var(--td-accent)] p-8 md:p-12 rounded-xl relative overflow-hidden shadow-sm ring-1 ring-[var(--td-ring)] selection:bg-red-100 selection:text-red-900"
    >
      <Scale
        className="absolute -right-16 -top-16 w-64 h-64 text-zinc-100 pointer-events-none opacity-40"
        strokeWidth={1}
        aria-hidden
      />
      <div className="relative z-10 max-w-4xl">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--td-accent)] block mb-4">
          {lang === 'cn' ? 'Final verdict / 最终判决' : 'FINAL VERDICT'}
        </span>
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={isErased ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
          transition={{ duration: 0.32, delay: 0.05, ease: [0.25, 0.1, 0.25, 1] }}
          className="text-2xl md:text-3xl font-semibold tracking-tight leading-snug text-[var(--td-text-primary)] not-italic"
        >
          <span className="text-zinc-400 font-normal select-none" aria-hidden>
            &ldquo;
          </span>
          {verdict}
          <span className="text-zinc-400 font-normal select-none" aria-hidden>
            &rdquo;
          </span>
        </motion.p>
      </div>
    </motion.div>
  );
}
