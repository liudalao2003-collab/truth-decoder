"use client";

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ChevronLeft, Eye, Terminal } from 'lucide-react';
import { i18n } from '@/config/i18n';
import { DecodeResult } from '@/types';
import RawNarrative from '@/components/features/decode/RawNarrative';
import HardFacts from '@/components/features/decode/HardFacts';
import VerdictPanel from '@/components/features/decode/VerdictPanel';
import ChatTerminal from '@/components/features/terminal/ChatTerminal';
import LoadingSkeleton from '@/components/features/decode/LoadingSkeleton';
import { logger } from '@/utils/logger';

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
      logger.start(`发起信号提取逻辑, ID: ${signalId}`);
      try {
        const res = await fetch(`/api/report/${signalId}`);
        const json = await res.json();
        
        if (!res.ok || !json.success) throw new Error(json.error || '无法提取报告');

        setRawContent(json.data.rawContent);
        setResult(json.data.result);
        setViewCount(json.data.viewCount);
        logger.success('商业情报已成功同步至前端 State');
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : '网络通信阻断';
        logger.crash(`报告加载失败: ${errMsg}`);
        setError(errMsg);
      } finally {
        setIsLoading(false);
      }
    };
    fetchReport();
  }, [signalId]);

  return (
    <div className="min-h-screen bg-black text-zinc-300 p-4 md:p-8 font-sans selection:bg-red-900 selection:text-white relative overflow-hidden">
      <div className="max-w-7xl mx-auto space-y-12 relative z-10">
        
        {/* 顶部 Header - 始终保持挂载，提供稳定的交互入口 [cite: 107-110] */}
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
          </div>
        </header>

        {/* 核心内容区：骨架屏与真实内容的平滑切换 */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="skeleton"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            >
              <LoadingSkeleton />
            </motion.div>
          ) : error || !result ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900/50 border border-red-900/30 p-12 rounded-sm text-center max-w-2xl mx-auto"
            >
              <h2 className="text-xl font-bold text-white mb-4 uppercase tracking-widest">信号已被物理抹除</h2>
              <p className="text-zinc-500 font-mono text-sm mb-8">{error || 'Unknown Signal Loss'}</p>
              <button onClick={() => router.push('/')} className="bg-red-700 text-white px-10 py-3 font-black uppercase text-xs tracking-widest hover:bg-red-600 transition-colors">返回拦截首页</button>
            </motion.div>
          ) : (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ staggerChildren: 0.2 }}
              className="space-y-12"
            >
              {/* 核心解码面板 [cite: 110-111] */}
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8 }}
                className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              >
                <RawNarrative rawContent={rawContent} fluffWords={result.fluffWords} isErased={isErased} />
                <HardFacts hardFacts={result.hardFacts} isErased={isErased} onErase={() => setIsErased(true)} />
              </motion.div>
              
              <VerdictPanel verdict={result.verdict} isErased={isErased} />

              {/* 独立审讯终端 [cite: 111-113] */}
              <motion.section 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="pt-12 border-t-2 border-dashed border-zinc-900"
              >
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black uppercase tracking-widest text-white flex items-center gap-3 mb-2">
                      <Terminal className="text-red-700 w-6 h-6" />
                      DEEP INTERROGATION
                    </h2>
                    <p className="text-zinc-500 font-mono text-sm tracking-widest">{'>>'} 基于已查明的硬通货事实，发起对深层利益链的拷问。</p>
                  </div>
                </div>
                <ChatTerminal signalId={signalId} hardFacts={result.hardFacts} />
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}