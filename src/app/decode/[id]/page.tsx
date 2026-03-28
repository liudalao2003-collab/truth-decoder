"use client";
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, AlertCircle, Trash2, Zap, ShieldAlert, Globe } from 'lucide-react';
import RawNarrative from '@/components/features/decode/RawNarrative';
import DossierReader from '@/components/features/decode/DossierReader';
import VerdictPanel from '@/components/features/decode/VerdictPanel';
import ChatTerminal from '@/components/features/terminal/ChatTerminal'; // 🚀 寻回终端组件
import { SignalRecord } from '@/types/database';
import { useGlobalLang } from '@/hooks/useGlobalLang';
import { useDossierStream } from '@/hooks/useDossierStream';

export default function DecodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  
  const { lang, setLang } = useGlobalLang();
  const [signal, setSignal] = useState<SignalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dictionary, setDictionary] = useState<Record<string, string>>({});

  const { dossierContent, setDossierContent, isStreamingDossier, startDossierStream } = useDossierStream(signal, lang);

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

  useEffect(() => {
    if (signal) {
      const cnFluffs = Array.isArray(signal.fluff_words) ? signal.fluff_words : (signal.fluff_words as any)?.['cn'] || [];
      const enFluffs = Array.isArray(signal.fluff_words) ? signal.fluff_words : (signal.fluff_words as any)?.['en'] || [];
      const targetFluffs = lang === 'en' ? enFluffs : cnFluffs;
      buildDictionary(cnFluffs, enFluffs, targetFluffs, signal.raw_content || '');
    }
  }, [signal, lang]);

  const buildDictionary = (cnFluffs: string[], enFluffs: string[], targetFluffs: string[], rawText: string) => {
    const dict: Record<string, string> = {};
    const maxLen = Math.max(cnFluffs.length, enFluffs.length);

    for (let i = 0; i < maxLen; i++) {
      const cnSentence = cnFluffs[i] || "";
      const enSentence = enFluffs[i] || "";
      const hoverText = targetFluffs[i] || cnSentence || enSentence;
      let found = false;

      const searchQuotes = (sentence: string) => {
        let localFound = false;
        const quoteRegex = /['"‘“【\[](.*?)['"’”】\]]/g;
        let match;
        while ((match = quoteRegex.exec(sentence)) !== null) {
          const keyword = match[1].trim();
          if (keyword.length >= 3 && rawText.includes(keyword)) {
            dict[keyword] = hoverText;
            localFound = true;
          }
        }
        return localFound;
      };

      if (searchQuotes(cnSentence)) found = true;
      if (!found && searchQuotes(enSentence)) found = true;

      if (!found) {
        const cnMarkers = ["暗示", "掩盖", "意味着", "说明", "意图", "试图", "包装", "宣称", "掩饰"];
        for (const marker of cnMarkers) {
          if (cnSentence.includes(marker)) {
            const prefix = cnSentence.split(marker)[0];
            const potentialCnWord = prefix.replace(/[^\u4e00-\u9fa5]/g, '').slice(-8);
            if (potentialCnWord.length >= 2 && rawText.includes(potentialCnWord)) {
              dict[potentialCnWord] = hoverText;
              found = true;
              break;
            }
          }
        }

        if (!found) {
          const enMarkers = ["implies", "covers up", "means", "indicates", "intends to", "tries to", "packages", "claims", "hides", "masks", "distracts"];
          for (const marker of enMarkers) {
            const lowerEn = enSentence.toLowerCase();
            if (lowerEn.includes(marker)) {
              const splitIdx = lowerEn.indexOf(marker);
              const prefix = enSentence.substring(0, splitIdx).trim();
              const words = prefix.split(/\s+/);
              if (words.length > 0) {
                const potentialEnWord = words.slice(-3).join(" ").replace(/[^\w\s-]/g, '');
                if (potentialEnWord.length >= 4 && rawText.includes(potentialEnWord)) {
                  dict[potentialEnWord] = hoverText;
                  found = true;
                  break;
                }
              }
            }
          }
        }
      }
    }
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

  const getBilingualVerdict = () => (signal.metadata?.bilingual?.[lang] || signal.verdict);
  const currentHardFacts = Array.isArray(signal.hard_facts) ? signal.hard_facts : ((signal.hard_facts as any)?.[lang] || []);

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

        {/* 🚀 寻回的深度审讯终端工作区 */}
        <div className="mt-12 border-t border-zinc-900 pt-12">
          <ChatTerminal signalId={id} hardFacts={currentHardFacts} />
        </div>

      </div>
    </main>
  );
}