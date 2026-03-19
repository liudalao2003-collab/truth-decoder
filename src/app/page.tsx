"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Sparkles, Loader2, AlertTriangle, Terminal, Activity, Zap, Cpu, ArrowRight } from 'lucide-react';
import { i18n } from '@/config/i18n';
import { SignalRecord } from '@/types/database';

export default function HomePage() {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<SignalRecord[]>([]);
  const router = useRouter();

  // 轮询最新情报流
  useEffect(() => {
    const fetchFeed = async () => {
      const res = await fetch('/api/feed');
      const json = await res.json();
      if (json.success) setFeed(json.data);
    };
    fetchFeed();
    const timer = setInterval(fetchFeed, 10000); 
    return () => clearInterval(timer);
  }, []);

  const handleStart = async () => {
    if (!input.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/decode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input })
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || '引擎调度失败');
      router.push(`/decode/${json.data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '未知网络错误');
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8 relative selection:bg-red-950">
      <div className="scanline" />
      
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 左侧：情报控制中心 */}
        <div className="lg:col-span-7 space-y-8">
          <header className="flex items-center justify-between border-b-2 border-red-900/30 pb-6">
            <div className="flex items-center gap-5">
              <ShieldAlert className="text-red-600 w-12 h-12" />
              <div>
                <h1 className="text-3xl font-black tracking-tighter uppercase italic">{i18n.header.title}</h1>
                <p className="text-[10px] font-mono text-red-600 tracking-[0.4em]">{i18n.header.version}</p>
              </div>
            </div>
            <div className="hidden md:flex gap-6 font-mono text-[10px] text-zinc-600">
              <div className="flex items-center gap-2"><Activity size={12} className="text-green-800" /> STATUS: STABLE</div>
              <div className="flex items-center gap-2"><Cpu size={12} className="text-red-800" /> DEEPSEEK_V3</div>
            </div>
          </header>

          <section className="bg-zinc-950 border border-zinc-900 p-8 rounded-sm relative overflow-hidden flex flex-col group min-h-[650px]">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><Terminal size={200} /></div>
            <div className="flex items-center gap-3 mb-8">
               <Zap size={18} className="text-red-700" />
               <h2 className="text-sm font-black uppercase tracking-widest text-zinc-500">{i18n.home.title}</h2>
            </div>
            
            <textarea 
              className="flex-1 w-full bg-black/50 border border-zinc-900 p-8 text-lg font-serif outline-none focus:border-red-900/50 transition-all resize-none mb-8 placeholder:text-zinc-800"
              placeholder={i18n.home.placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isSubmitting}
            />
            
            <button 
              onClick={handleStart}
              disabled={!input.trim() || isSubmitting}
              className={`w-full py-8 text-xl font-black uppercase tracking-[0.5em] flex items-center justify-center gap-4 transition-all border ${
                !input.trim() || isSubmitting 
                ? 'bg-transparent border-zinc-900 text-zinc-800' 
                : 'bg-red-950/20 border-red-900 text-red-500 hover:bg-red-900 hover:text-white'
              }`}
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {isSubmitting ? 'ENGAGING...' : i18n.home.button}
            </button>
          </section>
        </div>

        {/* 右侧：LIVE TRUTH FEED */}
        <div className="lg:col-span-5 flex flex-col bg-zinc-950/20 border-l border-zinc-900 p-6">
          <div className="flex items-center justify-between mb-8 border-b border-zinc-900 pb-4">
            <h3 className="text-xs font-black tracking-[0.3em] uppercase text-zinc-500 flex items-center gap-3">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-ping" />
              Intelligence Stream
            </h3>
            <span className="text-[9px] font-mono text-zinc-700">SYNC_OK</span>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto max-h-[800px] scrollbar-none">
            <AnimatePresence mode='popLayout'>
              {feed.length === 0 ? (
                <div className="h-40 flex items-center justify-center border border-dashed border-zinc-900 rounded-sm">
                   <p className="text-[10px] font-mono text-zinc-800 uppercase tracking-widest">Awaiting Fresh Signals...</p>
                </div>
              ) : feed.map((item, idx) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => router.push(`/decode/${item.id}`)}
                  className="group relative bg-black border border-zinc-900 p-6 hover:border-red-900/50 transition-all cursor-pointer overflow-hidden shadow-xl"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-900 opacity-20 group-hover:opacity-100 transition-all" />
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[9px] font-mono text-zinc-700 uppercase">SIGNAL_{item.id}</span>
                    <ArrowRight size={12} className="text-zinc-800 group-hover:text-red-600 transition-colors" />
                  </div>
                  <p className="text-sm font-bold text-zinc-400 group-hover:text-white transition-colors leading-relaxed line-clamp-3 italic">
                    {item.verdict}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  );
}