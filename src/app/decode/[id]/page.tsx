"use client";
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, ChevronLeft, AlertTriangle, Eye } from 'lucide-react';
import { i18n } from '@/config/i18n';
import { DecodeResult } from '@/types';
import RawNarrative from '@/components/features/decode/RawNarrative';
import HardFacts from '@/components/features/decode/HardFacts';
import VerdictPanel from '@/components/features/decode/VerdictPanel';
import ChatTerminal from '@/components/features/terminal/ChatTerminal';

type PageProps = { params: Promise<{ id: string }> };

export default function DecodePage({ params }: PageProps) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const signalId = unwrappedParams.id;
  
  const [isErased, setIsErased] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [rawContent, setRawContent] = useState('');
  const [result, setResult] = useState<DecodeResult | null>(null);
  const [viewCount, setViewCount] = useState<number>(0);

  useEffect(() => {
    const fetchReport = async () => {
      console.log('🟡 [网络请求] -> 接口: /api/report, 请求读取缓存库');
      try {
        const res = await fetch(`/api/report/${signalId}`);
        const json = await res.json();
        
        if (!res.ok || !json.success) throw new Error(json.error || '无法提取报告');

        console.log('🔵 [数据渲染] -> 组件: 成功挂载持久化数据');
        setRawContent(json.data.rawContent);
        setResult(json.data.result);
        setViewCount(json.data.viewCount);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : '网络通信阻断';
        setError(errMsg);
      } finally {
        setIsLoading(false);
      }
    };
    fetchReport();
  }, [signalId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
        <div className="relative">
          <ShieldAlert className="w-16 h-16 text-zinc-800 animate-pulse" />
          <div className="absolute inset-0 border-t-2 border-zinc-500 rounded-full animate-spin" />
        </div>
        <p className="mt-6 text-zinc-500 font-mono tracking-widest text-sm uppercase">Retrieving Asset...</p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8">
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-sm text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-zinc-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">报告提取失败</h2>
          <p className="text-zinc-400 text-sm mb-6">{error}</p>
          <button onClick={() => router.push('/')} className="bg-white text-black px-6 py-2 font-bold uppercase text-sm rounded-sm hover:bg-zinc-300">返回重试</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-300 p-4 md:p-8 font-sans selection:bg-red-900 selection:text-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto space-y-8 relative z-10">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-6">
          <div className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => router.push('/')}>
            <ChevronLeft className="text-zinc-500" />
            <ShieldAlert className="w-8 h-8 text-red-600" />
            <h1 className="text-2xl font-black tracking-tighter text-white uppercase">{i18n.header.title}</h1>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400 border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 rounded-sm tracking-widest">
              <Eye className="w-3 h-3 text-red-500" />
              <span>VIEWS: {viewCount}</span>
            </div>
            <div className="text-[10px] font-mono text-zinc-500 border border-zinc-800 bg-zinc-900 px-3 py-1.5 rounded-sm tracking-widest cursor-copy" title="复制链接即可分享">
              SIGNAL: {signalId}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RawNarrative rawContent={rawContent} fluffWords={result.fluffWords} isErased={isErased} />
          <HardFacts hardFacts={result.hardFacts} isErased={isErased} onErase={() => setIsErased(true)} />
        </div>
        <VerdictPanel verdict={result.verdict} isErased={isErased} />
      </div>

      {/* 🚀 核心装载：挂载商业化交互终端 */}
      <ChatTerminal signalId={signalId} hardFacts={result.hardFacts} />
    </div>
  );
}