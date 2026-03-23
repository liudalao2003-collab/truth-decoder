"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldAlert, Sparkles, Loader2, AlertTriangle, ArrowRight 
} from 'lucide-react';
import { SignalRecord } from '@/types/database';

export default function HomePage() {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null); // 🚨 故障状态已就绪
  
  const [feed, setFeed] = useState<SignalRecord[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  
  useEffect(() => {
    fetchFeed();
  }, []);

  const fetchFeed = async (isLoadMore = false) => {
    if (isLoadMore && isLoadingMore) return;
    if (isLoadMore) setIsLoadingMore(true);
    const cursor = isLoadMore && feed.length > 0 ? feed[feed.length - 1].created_at : '';
    try {
      const res = await fetch(`/api/feed?cursor=${encodeURIComponent(cursor)}`);
      const json = await res.json();
      if (json.success) {
        if (isLoadMore) {
          setFeed(prev => {
            const existingIds = new Set(prev.map(item => item.id));
            const uniqueNewData = json.data.filter((item: SignalRecord) => !existingIds.has(item.id));
            return [...prev, ...uniqueNewData];
          });
          if (json.data.length < 15) setHasMore(false);
        } else {
          setFeed(json.data);
          if (json.data.length >= 15) setHasMore(true);
        }
      }
    } catch (e) { console.error(e); }
    finally { setIsLoadingMore(false); setIsInitialLoading(false); }
  };

  const handleStart = async () => {
    if (!input.trim() || isSubmitting) return;
    setIsSubmitting(true);
    setError(null); // 每次点击前清空历史错误
    try {
      const res = await fetch('/api/v1/ingest', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ=`
        },
        body: JSON.stringify({ rawContent: input })
      });
      const json = await res.json();
      
      // 🚀 核心判定：只在 100% 确认拿到 ID 时跳转
      if (json.success && json.data?.signalId) {
        setInput('');
        router.push(`/decode/${json.data.signalId}`);
      } else { 
        // 否则必定抛出给 Catch 块
        throw new Error(json.error || '引擎拒绝入库 (发生未知错误)'); 
      }
    } catch (err: any) { 
      console.error("提交被拦截:", err.message);
      setError(err.message); // 把错误信息挂载到界面上
    } finally {
      setIsSubmitting(false); // 必须重置按钮状态
    }
  };

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8 relative selection:bg-red-950">
      <div className="scanline" />
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* 左侧控制台 */}
        <div className="lg:col-span-7 space-y-8">
          <header className="flex items-center justify-between border-b-2 border-red-900/30 pb-6">
            <div className="flex items-center gap-5">
              <ShieldAlert className="text-red-600 w-12 h-12" />
              <div>
                <h1 className="text-3xl font-black tracking-tighter uppercase italic">Truth Decoder</h1>
                <p className="text-[10px] font-mono text-red-600 tracking-[0.4em]">v5.0 SECURE_GATE</p>
              </div>
            </div>
          </header>

          <section className="bg-zinc-950 border border-zinc-900 p-8 rounded-sm relative overflow-hidden group min-h-[600px] flex flex-col">
            <textarea 
              className="flex-1 w-full bg-black/30 border border-zinc-900 p-8 text-lg font-serif outline-none focus:border-red-900/50 transition-all resize-none mb-8 placeholder:text-zinc-800"
              placeholder="请在此粘贴长篇大论的官方通稿..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isSubmitting}
            />
            
            <button 
              onClick={handleStart}
              disabled={!input.trim() || isSubmitting}
              className={`w-full py-8 text-xl font-black uppercase tracking-[0.5em] flex items-center justify-center gap-4 transition-all border ${
                !input.trim() || isSubmitting ? 'bg-transparent border-zinc-900 text-zinc-800 cursor-not-allowed' : 'bg-red-950/20 border-red-900 text-red-500 hover:bg-red-900 hover:text-white'
              }`}
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {isSubmitting ? 'Securing Intelligence...' : '载入去伪存真引擎'}
            </button>

            {/* 🚨 故障监控屏 (本次修复核心) */}
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-6 p-5 bg-red-950/30 border border-red-900 flex items-start gap-4 rounded-sm"
                >
                  <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
                  <div>
                    <h4 className="text-[10px] font-mono text-red-500 uppercase tracking-widest mb-1.5 font-bold">System Fault / 引擎驳回</h4>
                    <p className="text-sm text-red-400 font-mono leading-relaxed">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </section>
        </div>

        {/* 右侧情报流 */}
        <div className="lg:col-span-5 flex flex-col bg-zinc-950/20 border-l border-zinc-900 p-6 h-[90vh]">
          <div className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-900">
            <AnimatePresence mode='popLayout'>
              {feed.map((item) => (
                <motion.div 
                  key={item.id}
                  layout
                  onClick={() => router.push(`/decode/${item.id}`)}
                  className="group relative bg-black border border-zinc-900 p-6 hover:border-red-900/50 transition-all cursor-pointer overflow-hidden active:scale-[0.98]"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-900 opacity-20 group-hover:opacity-100 transition-all" />
                  <p className="text-sm font-bold text-zinc-400 group-hover:text-white transition-colors italic line-clamp-2">“{item.verdict}”</p>
                </motion.div>
              ))}
            </AnimatePresence>
            {hasMore && !isInitialLoading && (
              <button onClick={() => fetchFeed(true)} className="w-full py-4 text-[10px] text-zinc-600 uppercase font-mono hover:text-red-500 transition-colors">Access Historical Intel</button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}