"use client";
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertCircle, Trash2, Zap, ShieldAlert, Globe } from 'lucide-react';
import RawNarrative from '@/components/features/decode/RawNarrative';
import DossierReader from '@/components/features/decode/DossierReader';
import VerdictPanel from '@/components/features/decode/VerdictPanel';
import ChatTerminal from '@/components/features/terminal/ChatTerminal'; 
import AuthModal from '@/components/features/auth/AuthModal'; 
import { SignalRecord, BilingualData } from '@/types/database'; 
import { useGlobalLang } from '@/hooks/useGlobalLang';
import { useDossierStream } from '@/hooks/useDossierStream';
import { createClient } from '@/lib/supabase/client';

export default function DecodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const { lang, setLang } = useGlobalLang();
  const [signal, setSignal] = useState<SignalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dictionary, setDictionary] = useState<Record<string, string>>({});
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authContext, setAuthContext] = useState({ title: '', subtitle: '' });

  const { dossierContent, isStreamingDossier, startDossierStream } = useDossierStream(signal, lang);

  useEffect(() => { 
     const fetchSignal = async () => { 
       try { 
         const res = await fetch(`/api/decode?id=${id}`); 
         if (!res.ok) { setSignal(null); return; } 
         const json = await res.json(); 
         if (json.success) { setSignal(json.data); } else { setSignal(null); } 
       } catch (e: unknown) { 
         if (process.env.NODE_ENV === 'development') {
           console.log("🔴 [模块_崩溃] -> 渲染总线异常:", e instanceof Error ? e.message : e); 
         }
         setSignal(null); 
       } finally { setLoading(false); } 
     }; 
     fetchSignal(); 
   }, [id]);

  // 🚀 核心修复 1：注入真实强悍的字典构建引擎
  useEffect(() => {
    if (signal) {
      const f = signal.fluff_words;
      const cnFluffs = Array.isArray(f) ? f : (f as BilingualData)?.cn || [];
      const enFluffs = Array.isArray(f) ? f : (f as BilingualData)?.en || [];
      const targetFluffs = lang === 'en' ? enFluffs : cnFluffs;
      
      const dict: Record<string, string> = {}; 
      
      // 物理级解析大模型的 Fluff 数组
      targetFluffs.forEach((item) => {
        if (!item) return;
        // 优先匹配 V5.6 契约的直角引号： 「词汇」解释
        let match = item.match(/「(.*?)」([\s\S]*)/);
        // 降级兼容旧版的双引号： “词汇”解释 或 "词汇"解释
        if (!match) match = item.match(/["“](.*?)["”][:：]?([\s\S]*)/);
        
        if (match && match[1].trim()) {
          const key = match[1].trim();
          const insight = match[2].trim();
          dict[key] = insight;
        }
      });
      
      setDictionary(dict);
    }
  }, [signal, lang]);

  const handleDossierClick = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setAuthContext({
        title: "DOSSIER LOCKED / 卷宗锁定",
        subtitle: "暗影卷宗包含麦肯锡级深度研报。登录以解锁流式破译协议。"
      });
      setIsAuthModalOpen(true);
      return;
    }
    startDossierStream();
  };

  const handlePurge = async () => {
    const confirmPurge = window.confirm("⚠️ [PURGE PROTOCOL]\n确认抹杀？");
    if (!confirmPurge) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/delete?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ=` }
      });
      const json = await res.json();
      if (json.success) { router.push('/'); } else { alert(`抹杀失败: ${json.error}`); }
    } catch (e: unknown) { 
      alert("通信切断，无法执行抹杀。"); 
    } finally { setIsDeleting(false); }
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="animate-spin text-zinc-500 w-8 h-8" /></div>;
  if (!signal) return <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center"><AlertCircle className="text-red-600 w-12 h-12 mb-4" /><h2 className="text-zinc-400 font-mono text-sm">Asset Neutralized</h2><button onClick={() => router.push('/')} className="mt-8 px-6 py-2 border border-zinc-800 text-zinc-500 hover:bg-white hover:text-black transition-all">Back to Index</button></div>;

  const getBilingualVerdict = () => (signal.metadata?.bilingual?.[lang] || signal.verdict);
  
  const h = signal.hard_facts;
  const currentHardFacts = Array.isArray(h) ? h : (lang === 'en' ? (h as BilingualData)?.en : (h as BilingualData)?.cn) || [];

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-zinc-300 font-sans selection:bg-zinc-800 selection:text-white pb-24">
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} title={authContext.title} subtitle={authContext.subtitle} />
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

        <section className="mb-10"><VerdictPanel verdict={getBilingualVerdict() as string} isErased={true} /></section>

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
                  {lang === 'cn' ? "深层情报引擎已准备就绪。" : "Deep intelligence engine ready."}
                </p>
                <button onClick={handleDossierClick} className="group relative bg-red-950/30 border border-red-900 text-red-500 hover:bg-red-900 hover:text-white transition-all px-10 py-5 uppercase font-black tracking-widest text-sm flex items-center gap-3 rounded-sm shadow-[0_0_30px_rgba(153,27,27,0.2)]">
                  <Zap size={18} className="group-hover:animate-pulse" />
                  <span>{lang === 'cn' ? '激活暗影卷宗' : 'GENERATE DOSSIER'}</span>
                </button>
              </div>
            ) : (
              <DossierReader content={dossierContent} isStreaming={isStreamingDossier} dictionary={dictionary} />
            )}
          </div>
        </div>

        <div className="mt-12 border-t border-zinc-900 pt-12">
          <ChatTerminal signalId={id} hardFacts={currentHardFacts} onRequireAuth={() => {
                setAuthContext({ title: "QUOTA EXCEEDED", subtitle: "登录以解除深度审讯终端的频率限制。" });
                setIsAuthModalOpen(true);
            }}
          />
        </div>
      </div>
    </main>
  );
}