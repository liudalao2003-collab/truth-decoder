"use client";
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertCircle, Target, Skull, Database, Trash2 } from 'lucide-react';
import RawNarrative from '@/components/features/decode/RawNarrative';
import { SignalRecord } from '@/types/database';

export default function DecodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [signal, setSignal] = useState<SignalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false); // 🚀 抹杀状态
  const [lang, setLang] = useState<'cn' | 'en'>('cn');

  useEffect(() => {
    const fetchSignal = async () => {
      try {
        const res = await fetch(`/api/decode?id=${id}`);

        // 🛡️ 柔性拦截：如果查不到数据（404），不要抛出 Error 炸毁前端，而是静默退出
        if (!res.ok) {
          setSignal(null);
          return;
        }

        const json = await res.json();
        if (json.success) {
          setSignal(json.data);
        } else {
          setSignal(null);
        }
      } catch (e) {
        console.error("链路切断:", e);
        setSignal(null);
      } finally {
        setLoading(false);
      }
    };
    fetchSignal();
  }, [id]);

  // 🔪 核心逻辑：执行物理抹杀
  const handlePurge = async () => {
    const confirmPurge = window.confirm("⚠️ [PURGE PROTOCOL]\n\n此操作将从数据库中物理销毁该情报，永久不可逆转。\n\n确认抹杀？");
    if (!confirmPurge) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/delete?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ=` // 使用你的最高权限 Token
        }
      });
      const json = await res.json();
      
      if (json.success) {
        // 抹杀成功，无缝撤退回首页
        router.push('/');
      } else {
        alert(`抹杀失败: ${json.error}`);
      }
    } catch (e) {
      alert("终端通信切断，无法执行抹杀指令。");
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <Loader2 className="animate-spin text-zinc-500 w-8 h-8" />
    </div>
  );

  if (!signal) return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center">
      <AlertCircle className="text-red-600 w-12 h-12 mb-4" />
      <h2 className="text-zinc-400 font-mono uppercase tracking-widest text-sm">Asset Neutralized / 资产已被销毁</h2>
      <button onClick={() => router.push('/')} className="mt-8 px-6 py-2 border border-zinc-800 text-zinc-500 font-mono text-xs hover:bg-white hover:text-black transition-all">Back to Index</button>
    </div>
  );

  const getBilingualField = (field: any) => (Array.isArray(field) ? field : field?.[lang] || []);
  const getBilingualVerdict = () => (signal.metadata?.bilingual?.[lang] || signal.verdict);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-zinc-300 font-sans selection:bg-zinc-800 selection:text-white pb-24">
      <div className="max-w-5xl mx-auto px-6">
        
        {/* 顶部导航 */}
        <header className="py-8 flex items-center justify-between border-b border-zinc-900 mb-12">
          <button onClick={() => router.push('/')} className="flex items-center gap-3 text-zinc-500 hover:text-white transition-all">
            <ArrowLeft size={16} />
            <span className="text-xs font-mono uppercase tracking-widest">Index</span>
          </button>
          
          <div className="flex items-center gap-4">
            <div className="flex bg-black border border-zinc-800 rounded-sm overflow-hidden">
              <button onClick={() => setLang('cn')} className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${lang === 'cn' ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>CN</button>
              <button onClick={() => setLang('en')} className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all ${lang === 'en' ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>EN</button>
            </div>
            
            {/* 🔪 抹杀按钮 */}
            <button 
              onClick={handlePurge}
              disabled={isDeleting}
              className="group flex items-center justify-center w-8 h-8 bg-black border border-red-900/30 hover:bg-red-950/40 hover:border-red-600 transition-all rounded-sm disabled:opacity-50"
              title="物理抹杀该资产"
            >
              {isDeleting ? <Loader2 size={14} className="animate-spin text-red-600" /> : <Trash2 size={14} className="text-red-900 group-hover:text-red-500" />}
            </button>
          </div>
        </header>

        {/* 致命裁决 */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
             <div className="w-2 h-2 bg-red-600" />
             <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Final Verdict</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-[1.2]">
            {getBilingualVerdict()}
          </h2>
        </section>

        {/* 核心数据网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
           <div className="bg-[#111] border border-zinc-900 p-8 rounded-sm">
              <h4 className="flex items-center gap-3 text-zinc-400 font-mono text-xs uppercase tracking-[0.2em] mb-8 border-b border-zinc-800 pb-4">
                 <Target size={14} /> Hard Facts / 骨干事实
              </h4>
              <div className="space-y-6">
                 {getBilingualField(signal.hard_facts).map((fact: string, i: number) => (
                   <div key={i} className="flex gap-4 items-start">
                      <span className="font-mono text-[10px] text-zinc-600 mt-1 shrink-0">{(i+1).toString().padStart(2,'0')}</span>
                      <p className="text-zinc-300 font-serif leading-relaxed text-sm md:text-base">{fact}</p>
                   </div>
                 ))}
              </div>
           </div>
           
           <div className="bg-red-950/10 border border-red-900/30 p-8 rounded-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-900/10 rounded-full blur-3xl" />
              <h4 className="flex items-center gap-3 text-red-500 font-mono text-xs uppercase tracking-[0.2em] mb-8 border-b border-red-900/30 pb-4 relative z-10">
                 <Skull size={14} /> Hidden Agenda / 隐秘动机
              </h4>
              <div className="space-y-6 relative z-10">
                 {getBilingualField(signal.fluff_words).map((fluff: string, i: number) => (
                   <div key={i} className="flex gap-4 items-start">
                      <span className="font-mono text-[10px] text-red-900 mt-1 shrink-0">⚠</span>
                      <p className="text-red-200/90 font-serif leading-relaxed text-sm md:text-base">{fluff}</p>
                   </div>
                 ))}
              </div>
           </div>
        </div>

        {/* 原始数据库 */}
        <div>
           <h4 className="flex items-center gap-3 text-zinc-600 font-mono text-xs uppercase tracking-[0.2em] mb-6">
              <Database size={14} /> Raw Intercept / 原始截获数据
           </h4>
           <div className="bg-[#111] border border-zinc-900 p-8 rounded-sm font-serif text-sm leading-relaxed text-zinc-500 text-justify">
              {signal.raw_content}
           </div>
        </div>

      </div>
    </main>
  );
}