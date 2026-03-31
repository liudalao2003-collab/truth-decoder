"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Sparkles, Loader2, AlertTriangle, Globe, User as UserIcon } from 'lucide-react';
import AuthModal from '@/components/features/auth/AuthModal'; 
import { createClient } from '@/lib/supabase/client';
import { SignalRecord } from '@/types/database';
import { useGlobalLang } from '@/hooks/useGlobalLang';
import { type User } from '@supabase/supabase-js';

/**
 * 核心业务说明：
 * TruthDecoder 首页总线。
 * 集成了“工业级 JSON 防御装甲”与“流式缝合技术”，确保在极端坏账数据下 UI 绝不崩溃。
 */
export default function HomePage() {
  const router = useRouter();
  const { lang, setLang } = useGlobalLang();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false); 
  const [user, setUser] = useState<User | null>(null);

  const supabase = createClient(); 
  
  useEffect(() => { 
    const getUser = async () => { 
      const { data: { user: currentUser } } = await supabase.auth.getUser(); 
      setUser(currentUser); 
    }; 
    getUser(); 
  }, [supabase]);

  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    } catch (_e) { 
      const errMsg = _e instanceof Error ? _e.message : String(_e);
      if (process.env.NODE_ENV === 'development') {
        console.log('🔴 [模块_崩溃] -> 刷新 Feed 失败:', errMsg);
      }
    } finally { 
      setIsLoadingMore(false); 
      setIsInitialLoading(false); 
    }
  };

  const handleStart = async () => { 
    if (!input.trim() || isSubmitting) return; 
    setIsSubmitting(true); 
    setError(null); 

    try { 
      if (process.env.NODE_ENV === 'development') { 
        console.log('🟢 [模块_发起] -> 动作: 建立流式透传连接，准备静默接收 JSON'); 
      } 

      const res = await fetch('/api/v1/ingest', { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ=` 
        }, 
        body: JSON.stringify({ rawContent: input }) 
      }); 

      if (!res.ok || !res.body) throw new Error('流式引擎连接被拒'); 

      const reader = res.body.getReader(); 
      const decoder = new TextDecoder('utf-8'); 
      let done = false; 
      let buffer = ''; 
      let rawJsonString = ''; 

      while (!done) { 
        const { value, done: readerDone } = await reader.read(); 
        done = readerDone; 
        if (value) { 
          buffer += decoder.decode(value, { stream: true }); 
          const lines = buffer.split('\n'); 
          buffer = lines.pop() || ''; 

          for (const line of lines) { 
            const trimmedLine = line.trim(); 
            if (trimmedLine.startsWith('data: ') && !trimmedLine.includes('[DONE]')) { 
              try { 
                const data = JSON.parse(trimmedLine.slice(6)); 
                const delta = data.choices[0]?.delta?.content || ''; 
                if (delta) { 
                  rawJsonString += delta; 
                } 
              } catch (e) { /* 忽略流碎片解析异常 */ } 
            } 
          } 
        } 
      } 

      if (process.env.NODE_ENV === 'development') { 
        console.log('🟡 [模块_异步] -> 目标: JSON 流拼接完毕，启动绝对防御洗刷程序'); 
      } 

      // 3. 剥离 Markdown 干扰符 
      let cleanedJsonString = rawJsonString.replace(/```json/gi, '').replace(/```/g, '').trim(); 
      const firstBrace = cleanedJsonString.indexOf('{'); 
      const lastBrace = cleanedJsonString.lastIndexOf('}'); 
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) { 
        cleanedJsonString = cleanedJsonString.substring(firstBrace, lastBrace + 1); 
      } 
      
      /** * 🚨 V6.1 工业级 JSON 绝对防御装甲 
       * 1. 物理剔除换行、回车、制表符 
       * 2. 暴力修正非法双引号：修复键值对内部未经转义的双引号
       */ 
      cleanedJsonString = cleanedJsonString
        .replace(/[\n\r\t]/g, '') // 剔除控制字符
        .replace(/: "([\s\S]*?)"/g, (match, p1) => {
          // 针对 Value 中的双引号进行内部单引号化处理
          const fixedValue = p1.replace(/"/g, "'");
          return `: "${fixedValue}"`;
        });
      
      let intel; 
      try { 
        intel = JSON.parse(cleanedJsonString); 
      } catch (parseError) { 
        if (process.env.NODE_ENV === 'development') { 
          console.log('🔴 [模块_崩溃] -> JSON 结构损毁，触发逻辑降级:', cleanedJsonString); 
        } 
        // 🚨 绝对防御：解析失败直接注入兜底 JSON [cite: 84]
        intel = { 
          verdict: { 
            cn: "AI 输出格式畸形，已启用物理层容灾截断。", 
            en: "AI format corrupted. Physical disaster recovery enabled." 
          }, 
          facts: { cn: [], en: [] }, 
          fluff: { cn: [], en: [] } 
        }; 
      } 

      // 4. 闪电瞬时入库 
      const saveRes = await fetch('/api/v1/ingest/save', { 
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ=` 
        }, 
        body: JSON.stringify({ rawContent: input, intel }) 
      }); 

      const saveJson = await saveRes.json(); 

      if (saveJson.success && saveJson.data?.signalId) { 
        if (process.env.NODE_ENV === 'development') { 
          console.log('🔵 [模块_成功] -> 产物 ID:', saveJson.data.signalId); 
        } 
        setInput(''); 
        router.push(`/decode/${saveJson.data.signalId}`); 
      } else { 
        throw new Error(saveJson.error || '瞬时写入网关异常'); 
      } 

    } catch (_e) { 
      const errMsg = _e instanceof Error ? _e.message : '物理链路破译失败'; 
      if (process.env.NODE_ENV === 'development') { 
        console.log('🔴 [模块_崩溃] -> 原因:', errMsg); 
      } 
      setError(errMsg); 
    } finally { 
      setIsSubmitting(false); 
    } 
  };

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8 relative selection:bg-red-950">
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <div className="scanline" />
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          <header className="flex items-center justify-between border-b-2 border-red-900/30 pb-6">
            <div className="flex items-center gap-5">
              <ShieldAlert className="text-red-600 w-12 h-12" />
              <div>
                <h1 className="text-3xl font-black tracking-tighter uppercase italic">Truth Decoder</h1>
                <p className="text-[10px] font-mono text-red-600 tracking-[0.4em]">v6.1 SECURE_GATE</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-2 px-3 py-1 border border-zinc-800 rounded-sm bg-zinc-950">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">Commander_Active</span>
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-1 border border-red-900/50 rounded-sm bg-red-950/20 text-red-500 hover:bg-red-900 hover:text-white transition-all text-[10px] font-bold uppercase tracking-widest"
                >
                  <UserIcon size={12} /> Login
                </button>
              )}
              <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-900 rounded-sm p-1">
                <Globe className="text-zinc-600 w-4 h-4 ml-2" />
                <button onClick={() => setLang('cn')} className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-all rounded-sm ${lang === 'cn' ? 'bg-red-900/40 text-red-500' : 'text-zinc-500 hover:text-white'}`}>CN</button>
                <button onClick={() => setLang('en')} className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-all rounded-sm ${lang === 'en' ? 'bg-red-900/40 text-red-500' : 'text-zinc-500 hover:text-white'}`}>EN</button>
              </div>
            </div>
          </header>

          <section className="bg-zinc-950 border border-zinc-900 p-8 rounded-sm relative overflow-hidden group min-h-[600px] flex flex-col">
            <textarea 
              className="flex-1 w-full bg-black/30 border border-zinc-900 p-8 text-lg font-serif outline-none focus:border-red-900/50 transition-all resize-none mb-8 placeholder:text-zinc-800"
              placeholder={lang === 'cn' ? "请在此粘贴长篇大论的官方通稿..." : "Paste the official narrative here..."}
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
              {isSubmitting ? 'Securing Intelligence...' : (lang === 'cn' ? '载入去伪存真引擎' : 'INITIALIZE ENGINE')}
            </button>

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
                  <p className="text-sm font-bold text-zinc-400 group-hover:text-white transition-colors italic line-clamp-2">
                    “{item.metadata?.bilingual?.[lang] || item.verdict}”
                  </p>
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