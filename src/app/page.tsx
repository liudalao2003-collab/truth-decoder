"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Sparkles, Loader2, AlertTriangle, Terminal, ArrowRight } from 'lucide-react';
import { i18n } from '@/config/i18n';
import { SignalRecord } from '@/types/database';

export default function HomePage() {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<SignalRecord[]>([]);
  const router = useRouter();

  // 核心：初始化拉取自动化情报流
  useEffect(() => {
    fetch('/api/feed')
      .then(res => res.json())
      .then(json => {
        if (json.success) setFeed(json.data);
      });
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
    <main className="min-h-screen bg-black text-white p-6 md:p-12 selection:bg-red-900">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
        
        {/* 左侧：情报输入与控制中心 */}
        <div className="lg:col-span-7 space-y-12">
          <header className="flex items-center gap-4 border-b border-red-900/50 pb-8">
            <ShieldAlert className="text-red-600 w-16 h-16" />
            <div>
              <h1 className="text-5xl font-black tracking-tighter uppercase italic">{i18n.header.title}</h1>
              <p className="text-sm font-mono text-red-500 tracking-[0.3em]">{i18n.header.version}</p>
            </div>
          </header>

          <section className="bg-zinc-950 border border-zinc-800 p-8 rounded-sm shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10"><Terminal size={120} /></div>
            <h2 className="text-xl font-bold mb-6 border-l-4 border-red-700 pl-4">{i18n.home.title}</h2>
            <textarea 
              className="w-full h-80 bg-black border border-zinc-800 p-6 text-xl font-serif outline-none focus:border-red-600 transition-all resize-none mb-6"
              placeholder={i18n.home.placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isSubmitting}
            />
            <button 
              onClick={handleStart}
              disabled={!input.trim() || isSubmitting}
              className={`w-full py-6 text-xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all rounded-sm ${
                !input.trim() || isSubmitting ? 'bg-zinc-900 text-zinc-600' : 'bg-red-700 hover:bg-red-600 shadow-[0_0_30px_rgba(185,28,28,0.3)]'
              }`}
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {isSubmitting ? 'DECODING REALITY...' : i18n.home.button}
            </button>
            {error && <div className="mt-4 text-red-500 font-mono text-sm flex items-center gap-2"><AlertTriangle size={14} /> {error}</div>}
          </section>
        </div>

        {/* 右侧：TRUTH FEED 商业护城河 */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <h3 className="text-lg font-black tracking-widest uppercase text-zinc-400 flex items-center gap-2">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-ping" />
              Live Truth Feed
            </h3>
            <span className="text-[10px] font-mono text-zinc-600 uppercase">Automated Intel</span>
          </div>

          <div className="space-y-4 overflow-y-auto max-h-[850px] pr-2 scrollbar-thin scrollbar-thumb-zinc-800">
            {feed.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-zinc-900 text-zinc-700 font-mono uppercase text-xs">
                Scanning global signals...
              </div>
            ) : feed.map((item) => (
              <div 
                key={item.id}
                onClick={() => router.push(`/decode/${item.id}`)}
                className="group bg-zinc-950 border border-zinc-900 p-5 rounded-sm hover:border-red-900 transition-all cursor-pointer relative"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[10px] font-mono text-zinc-500 italic">SIG_{item.id}</span>
                  <span className="text-[10px] font-mono text-red-900 group-hover:text-red-600 transition-colors uppercase font-bold tracking-widest">Unlocked</span>
                </div>
                <p className="text-sm font-bold text-zinc-300 line-clamp-2 group-hover:text-white transition-colors mb-4 leading-relaxed">
                  {item.verdict}
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-zinc-900/50">
                  <div className="flex gap-1">
                    {[1, 2, 3].map(i => <div key={i} className="w-1 h-1 bg-red-900 rounded-full" />)}
                  </div>
                  <ArrowRight size={14} className="text-zinc-700 group-hover:text-red-600 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}