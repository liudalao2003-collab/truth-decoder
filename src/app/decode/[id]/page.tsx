"use client";
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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

export default function DecodePage() {
  // 🚨 架构师 V6.3 核心修复：废弃 use(params)，采用纯客户端钩子，彻底消灭 SSR 序列化崩溃
  const params = useParams();
  const id = params?.id as string;

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
     if (!id) return;
     const fetchSignal = async () => { 
       try { 
         const res = await fetch(`/api/decode?id=${id}`); 
         const json = await res.json(); 
         if (json.success) setSignal(json.data);
       } catch (err) { if (process.env.NODE_ENV === 'development') console.log("🔴 ERROR:", err); } 
       finally { setLoading(false); } 
     }; 
 
     fetchSignal(); 
   }, [id]);

  /**
   * 🚨 架构师重构 V6.3：废土拾荒级词典引擎
   * 无论 AI 是否遵守格式输出「词汇」，前端必须强行将其撕裂提取，恢复所有气泡！
   */
  useEffect(() => {
    if (signal) {
      const f = signal.fluff_words;
      const cnFluffs = Array.isArray(f) ? f : (f as BilingualData)?.['cn'] || [];
      const targetFluffs = Array.isArray(f) ? f : (f as BilingualData)?.[lang] || [];
      
      const dict: Record<string, string> = {}; 
      
      cnFluffs.forEach((item, idx) => {
        if (!item) return;
        
        let key = "";
        
        // 1. 标准动作：尝试提取被引号包裹的核心词
        let matchCn = item.match(/「(.*?)」/);
        if (!matchCn) matchCn = item.match(/["“](.*?)["”]/);

        if (matchCn && matchCn[1].trim()) {
          key = matchCn[1].trim();
        } else {
          // 2. 暴力降级：AI 没写括号？直接找冒号切分，强制抓取词汇
          const cleanItem = item.replace(/^\d+\.\s*/, ''); // 剔除标号
          const splitMatch = cleanItem.split(/[:：【\[]/);
          if (splitMatch.length > 1 && splitMatch[0].trim().length > 0) {
            key = splitMatch[0].trim();
          }
        }

        if (key) {
          const targetItem = targetFluffs[idx] || item;
          // 锁定真正解释的起点（找【或[），抛弃前面复读的原词
          let explanation = targetItem;
          const startIdx = targetItem.search(/[【\[]/);
          if (startIdx !== -1) {
              explanation = targetItem.substring(startIdx);
          }
          dict[key] = explanation.trim();
        }
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

  const handlePurge = async () => {
    const confirm = window.confirm("⚠️ [PURGE PROTOCOL] 物理抹杀此资产？");
    if (!confirm) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/delete?id=${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ=` } });
      const json = await res.json();
      if (json.success) router.push('/');
      else alert(`抹杀失败: ${json.error}`);
    } catch (_e) { alert("网络阻断"); } finally { setIsDeleting(false); }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-red-600 w-10 h-10" /></div>;
  if (!signal) return <div className="min-h-screen bg-black flex flex-col items-center justify-center"><AlertCircle className="text-red-600 w-12 h-12 mb-4" /><h2 className="text-zinc-500 font-mono text-sm uppercase">Signal Erased</h2></div>;

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
              <button onClick={() => setLang('cn')} className={`px-4 py-1.5 text-[10px] font-bold transition-all rounded-sm ${lang === 'cn' ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>CN</button>
              <button onClick={() => setLang('en')} className={`px-4 py-1.5 text-[10px] font-bold transition-all rounded-sm ${lang === 'en' ? 'bg-zinc-800 text-white' : 'text-zinc-600 hover:text-zinc-400'}`}>EN</button>
            </div>
            <button onClick={handlePurge} disabled={isDeleting} className="group flex items-center justify-center w-9 h-9 bg-black border border-red-900/30 hover:bg-red-950/40 hover:border-red-600 transition-all rounded-sm disabled:opacity-50"><Trash2 size={16} className="text-red-900 group-hover:text-red-500" /></button>
          </div>
        </header>

        <section className="mb-10"><VerdictPanel verdict={(signal.metadata?.bilingual?.[lang] || signal.verdict) as string} isErased={true} /></section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-5 sticky top-8">
             <RawNarrative rawContent={signal.raw_content} lang={lang} dictionary={dictionary} />
          </div>
          <div className="lg:col-span-7">
            {!dossierContent && !isStreamingDossier ? (
              <div className="bg-zinc-950 border border-zinc-900 p-20 flex flex-col items-center justify-center text-center rounded-sm h-[600px] shadow-2xl relative">
                <ShieldAlert className="w-16 h-16 text-zinc-800 mb-6" />
                <button onClick={handleDossierClick} className="group relative bg-red-950/30 border border-red-900 text-red-500 hover:bg-red-900 hover:text-white transition-all px-10 py-5 uppercase font-black tracking-widest text-sm flex items-center gap-3 rounded-sm shadow-[0_0_30px_rgba(153,27,27,0.2)]">
                  <Zap size={18} className="group-hover:animate-pulse" />
                  <span>{lang === 'cn' ? '激活暗影卷宗' : 'GENERATE DOSSIER'}</span>
                </button>
              </div>
            ) : ( <DossierReader content={dossierContent} isStreaming={isStreamingDossier} dictionary={dictionary} /> )}
          </div>
        </div>
 
        <div className="mt-12 border-t border-zinc-900 pt-12"><ChatTerminal signalId={id} hardFacts={currentHardFacts} onRequireAuth={() => { setAuthContext({ title: "QUOTA EXCEEDED", subtitle: "登录以解除频率限制。" }); setIsAuthModalOpen(true); }} /></div>
      </div>
    </main>
  );
}