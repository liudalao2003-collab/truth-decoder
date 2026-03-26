"use client";
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertCircle, Trash2, Zap, ShieldAlert, Globe } from 'lucide-react';
import RawNarrative from '@/components/features/decode/RawNarrative';
import DossierReader from '@/components/features/decode/DossierReader';
import VerdictPanel from '@/components/features/decode/VerdictPanel';
import { SignalRecord } from '@/types/database';
import { useGlobalLang } from '@/hooks/useGlobalLang';
import { useDossierStream } from '@/hooks/useDossierStream';

export default function DecodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  
  const { lang, setLang } = useGlobalLang(); // 🟢 接入全局语种
  const [signal, setSignal] = useState<SignalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dictionary, setDictionary] = useState<Record<string, string>>({});

  // 🟢 剥离 SSE 巨石逻辑
  const { dossierContent, setDossierContent, isStreamingDossier, startDossierStream } = useDossierStream(signal);

  useEffect(() => {
    const fetchSignal = async () => {
      try {
        const res = await fetch(`/api/decode?id=${id}`);
        if (!res.ok) { setSignal(null); return; }

        const json = await res.json();
        if (json.success) {
          setSignal(json.data);
          if (json.data.dossier_content) setDossierContent(json.data.dossier_content);
        } else {
          setSignal(null);
        }
      } catch (e) {
        setSignal(null);
      } finally {
        setLoading(false);
      }
    };
    fetchSignal();
  }, [id, setDossierContent]);

  // 🚀 监听全局 lang 变化，动态重构高亮词典
  useEffect(() => {
    if (signal) {
      // 兼容旧版 array 或新版 bilingual object
      const fluffs = Array.isArray(signal.fluff_words) 
        ? signal.fluff_words 
        : (signal.fluff_words as any)?.[lang] || [];
        
      buildDictionary(fluffs, signal.raw_content || '');
    }
  }, [signal, lang]);

  const buildDictionary = (fluffs: string[], rawText: string) => {
    const dict: Record<string, string> = {};
    const quoteRegex = /['"‘“【\[](.*?)['"’”】\]]/g;
    
    fluffs.forEach(sentence => {
      let match;
      let found = false;
      
      while ((match = quoteRegex.exec(sentence)) !== null) {
        const keyword = match[1].trim();
        if (keyword.length >= 2 && rawText.includes(keyword)) {
          dict[keyword] = sentence;
          found = true;
        }
      }
      
      if (!found && lang === 'cn') {
        const markers = ["暗示", "掩盖", "意味着", "说明", "意图"];
        for (const marker of markers) {
          if (sentence.includes(marker)) {
            const prefix = sentence.split(marker)[0];
            const potentialWord = prefix.replace(/[^\u4e00-\u9fa5]/g, '').slice(-6);
            if (potentialWord.length >= 2 && rawText.includes(potentialWord)) {
              dict[potentialWord] = sentence;
              break;
            }
          }
        }
      }
    });
    setDictionary(dict);
  };

  const handlePurge = async () => {
    const confirmPurge = window.confirm("⚠️ [PURGE PROTOCOL]\n\n物理销毁该情报，不可逆转。确认抹杀？");
    if (!confirmPurge) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/v1/delete?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ=` }
      });
      const json = await res.json();
      if (json.success) { router.push('/'); } else { alert(`抹杀失败: ${json.error}`); }
    } catch (e) { alert("通信切断，无法执行抹杀。"); } finally { setIsDeleting(false); }
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="animate-spin text-zinc-500 w-8 h-8" /></div>;
  if (!signal) return <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center"><AlertCircle className="text-red-600 w-12 h-12 mb-4" /><h2 className="text-zinc-400 font-mono text-sm">Asset Neutralized</h2><button onClick={() => router.push('/')} className="mt-8 px-6 py-2 border border-zinc-800 text-zinc-500 hover:bg-white hover:text-black transition-all">Back to Index</button></div>;

  // 🛡️ 核心防线：双语断层兜底渲染
  const getBilingualVerdict = () => (signal.metadata?.bilingual?.[lang] || signal.verdict);

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-zinc-300 font-sans selection:bg-zinc-800 selection:text-white pb-24">
      <div className="max-w-[1600px] mx-auto px-6">
        
        <header className="py-8 flex items-center justify-between border-b border-zinc-900 mb-8">
          <button onClick={() => router.push('/')} className="flex items-center gap-3 text-zinc-500 hover:text-white transition-all"><ArrowLeft size={16} /><span className="text-xs font-mono uppercase tracking-widest">Index</span></button>
          <div className="flex items-center gap-4">
            
            <div className="flex items-center gap-2 bg-black border border-zinc-800 rounded-sm p-1">
              <Globe className="text-zinc-600 w-4 h-4 ml-2" />
              <button onClick={() => setLang('cn')} className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all rounded-sm ${lang === 'cn' ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>CN</button>
              <button onClick={() => setLang('en')} className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all rounded-sm ${lang === 'en' ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>EN</button>
            </div>

            <button onClick={handlePurge} disabled={isDeleting} className="group flex items-center justify-center w-9 h-9 bg-black border border-red-900/30 hover:bg-red-950/40 hover:border-red-600 transition-all rounded-sm disabled:opacity-50"><Trash2 size={16} className="text-red-900 group-hover:text-red-500" /></button>
          </div>
        </header>

        <section className="mb-10"><VerdictPanel verdict={getBilingualVerdict()} isErased={true} /></section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 sticky top-8">
             <RawNarrative rawContent={signal.raw_content} fluffWords={signal.fluff_words} lang={lang} dictionary={dictionary} />
          </div>
          <div className="lg:col-span-7">
            {!dossierContent && !isStreamingDossier ? (
              <div className="bg-zinc-950 border border-zinc-900 p-12 md:p-20 flex flex-col items-center justify-center text-center rounded-sm shadow-2xl h-[600px]">
                <ShieldAlert className="w-16 h-16 text-zinc-800 mb-6" />
                <h3 className="text-xl font-black text-white uppercase tracking-widest mb-4">Classified Intelligence</h3>
                <p className="text-zinc-500 font-serif text-sm max-w-lg mb-10 leading-relaxed">
                  {lang === 'cn' ? "深层情报引擎已准备就绪。点击下方按钮，启动流式破译协议，生成麦肯锡级别的【暗影卷宗】商业备忘录。" : "Deep intelligence engine ready. Initialize streaming protocol to generate a McKinsey-grade Shadow Dossier."}
                </p>
                <button onClick={startDossierStream} className="group relative bg-red-950/30 border border-red-900 text-red-500 hover:bg-red-900 hover:text-white transition-all px-10 py-5 uppercase font-black tracking-widest text-sm flex items-center gap-3 rounded-sm shadow-[0_0_30px_rgba(153,27,27,0.2)]">
                  <Zap size={18} className="group-hover:animate-pulse" /><span className="relative z-10">{lang === 'cn' ? '激活暗影卷宗 (Generate Dossier)' : 'GENERATE DOSSIER'}</span>
                </button>
              </div>
            ) : (
              <DossierReader content={dossierContent} isStreaming={isStreamingDossier} dictionary={dictionary} />
            )}
          </div>
        </div>

      </div>
    </main>
  );
}