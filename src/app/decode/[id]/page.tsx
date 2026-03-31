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
         const json = await res.json(); 
         if (json.success) setSignal(json.data);
       } catch (e) { console.log("🔴 ERROR:", e); } 
       finally { setLoading(false); } 
     }; 
     fetchSignal(); 
   }, [id]);

  // 🚀 核心修复：注入真实的字典构建引擎，解决左侧气泡缺失
  useEffect(() => {
    if (signal) {
      const f = signal.fluff_words;
      const targetFluffs = Array.isArray(f) ? f : (f as BilingualData)?.[lang] || [];
      const dict: Record<string, string> = {}; 
      targetFluffs.forEach((item) => {
        if (!item) return;
        let match = item.match(/「(.*?)」([\s\S]*)/);
        if (!match) match = item.match(/["“](.*?)["”][:：]?([\s\S]*)/);
        if (match && match[1].trim()) dict[match[1].trim()] = match[2].trim();
      });
      setDictionary(dict);
    }
  }, [signal, lang]);

  const handleDossierClick = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setAuthContext({ title: "DOSSIER LOCKED", subtitle: "登录以解锁流式破译协议。" });
      setIsAuthModalOpen(true);
      return;
    }
    startDossierStream();
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><Loader2 className="animate-spin text-zinc-500 w-8 h-8" /></div>;
  if (!signal) return <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center"><AlertCircle className="text-red-600 w-12 h-12 mb-4" /><h2 className="text-zinc-400 font-mono text-sm">Asset Neutralized</h2></div>;

  const h = signal.hard_facts;
  const currentHardFacts = Array.isArray(h) ? h : (h as BilingualData)?.[lang] || [];

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-zinc-300 font-sans pb-24">
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} title={authContext.title} subtitle={authContext.subtitle} />
      <div className="max-w-[1600px] mx-auto px-6">
        <header className="py-8 flex items-center justify-between border-b border-zinc-900 mb-8">
          <button onClick={() => router.push('/')} className="flex items-center gap-3 text-zinc-500 hover:text-white transition-all"><ArrowLeft size={16} /><span className="text-xs font-mono uppercase tracking-widest">Index</span></button>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-black border border-zinc-800 rounded-sm p-1">
              <Globe className="text-zinc-600 w-4 h-4 ml-2" />
              <button onClick={() => setLang('cn')} className={`px-4 py-1.5 text-[10px] transition-all rounded-sm ${lang === 'cn' ? 'bg-zinc-800 text-white' : 'text-zinc-600'}`}>CN</button>
              <button onClick={() => setLang('en')} className={`px-4 py-1.5 text-[10px] transition-all rounded-sm ${lang === 'en' ? 'bg-zinc-800 text-white' : 'text-zinc-600'}`}>EN</button>
            </div>
          </div>
        </header>

        <section className="mb-10"><VerdictPanel verdict={(signal.metadata?.bilingual?.[lang] || signal.verdict) as string} isErased={true} /></section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 sticky top-8">
             <RawNarrative rawContent={signal.raw_content} lang={lang} dictionary={dictionary} />
          </div>
          <div className="lg:col-span-7">
            {!dossierContent && !isStreamingDossier ? (
              <div className="bg-zinc-950 border border-zinc-900 p-20 flex flex-col items-center justify-center text-center rounded-sm h-[600px]">
                <ShieldAlert className="w-16 h-16 text-zinc-800 mb-6" />
                <button onClick={handleDossierClick} className="bg-red-950/30 border border-red-900 text-red-500 hover:bg-red-900 hover:text-white transition-all px-10 py-5 uppercase font-black tracking-widest text-sm flex items-center gap-3 rounded-sm"><Zap size={18} /><span>{lang === 'cn' ? '激活暗影卷宗' : 'GENERATE DOSSIER'}</span></button>
              </div>
            ) : ( <DossierReader content={dossierContent} isStreaming={isStreamingDossier} dictionary={dictionary} /> )}
          </div>
        </div>
        <div className="mt-12 border-t border-zinc-900 pt-12"><ChatTerminal signalId={id} hardFacts={currentHardFacts} onRequireAuth={() => setIsAuthModalOpen(true)} /></div>
      </div>
    </main>
  );
}