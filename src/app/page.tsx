"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Sparkles, Loader2, AlertTriangle, Globe, User as UserIcon, LogOut } from 'lucide-react';
import AuthModal from '@/components/features/auth/AuthModal'; 
import { createClient } from '@/lib/supabase/client';
import { SignalRecord } from '@/types/database';
import { IntelProfileMiniBars } from '@/components/features/decode/IntelProfileRadar';
import { emptyIntelLockedKeys, guestIntelLockedKeys } from '@/lib/intel-profile-ui';
import { useGlobalLang } from '@/hooks/useGlobalLang';
import { type User } from '@supabase/supabase-js';

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

  // 🔧 新增：退出登录处理函数
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

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

      let cleanedJsonString = rawJsonString.replace(/```json/gi, '').replace(/```/g, '').trim();
      const firstBrace = cleanedJsonString.indexOf('{'); 
      const lastBrace = cleanedJsonString.lastIndexOf('}'); 
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) { 
        cleanedJsonString = cleanedJsonString.substring(firstBrace, lastBrace + 1);
      } else if (firstBrace !== -1) {
        cleanedJsonString = cleanedJsonString.substring(firstBrace);
      }
      
      let intel;
      try { 
        const sanitized = cleanedJsonString.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
        intel = JSON.parse(sanitized); 
      } catch (parseError) { 
        if (process.env.NODE_ENV === 'development') { 
          console.log('🔴 [模块_崩溃] -> JSON 结构损毁或截断，启动正则暴力抢救...');
        } 
        
        intel = { 
          verdict: { cn: "数据流不稳定，已启用物理层抢救协议，部分核心逻辑可能遗失。", en: "Stream Truncated. Rescue protocol engaged." }, 
          facts: { cn: [] as string[], en: [] as string[] }, 
          fluff: { cn: [] as string[], en: [] as string[] } 
        };

        try {
          const vMatch = cleanedJsonString.match(/"verdict"[\s\S]*?"cn"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
          if (vMatch) intel.verdict.cn = vMatch[1];

          const fMatch = cleanedJsonString.match(/"facts"[\s\S]*?"cn"\s*:\s*\[([\s\S]*?)\]/);
          if (fMatch) {
            intel.facts.cn = fMatch[1].split('",').map((s: string) => s.replace(/["\n]/g, '').trim()).filter(Boolean);
          }

          const flMatch = cleanedJsonString.match(/"fluff"[\s\S]*?"cn"\s*:\s*\[([\s\S]*?)\]/);
          if (flMatch) {
            intel.fluff.cn = flMatch[1].split('",').map((s: string) => s.replace(/["\n]/g, '').trim()).filter(Boolean);
          }
        } catch (rescueErr) {
          console.log('🔴 [模块_崩溃] -> 抢救失败:', rescueErr);
        }
      } 

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
    <main className="min-h-screen bg-[var(--td-surface-0)] text-[var(--td-text-primary)] p-4 md:p-8 relative selection:bg-red-100 selection:text-red-900">
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          <header className="flex items-center justify-between border-b border-[var(--td-border)] pb-6">
            <div className="flex items-center gap-5">
              <ShieldAlert className="text-red-600 w-12 h-12" />
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-zinc-950">Truth Decoder</h1>
                <p className="text-[10px] font-mono text-[var(--td-text-secondary)] tracking-[0.35em] uppercase">v6.2 SECURE_GATE</p>
              </div>
            </div>
           
            <div className="flex items-center gap-4">
              {user ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-1 border border-[var(--td-border)] rounded-md bg-[var(--td-surface-1)] shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-mono text-zinc-500 uppercase">Commander_Active</span>
                  </div>
                  <button
                    onClick={handleLogout}
                    title={lang === 'cn' ? '退出登录' : 'Log out'}
                    className="flex items-center gap-1.5 px-3 py-1 border border-[var(--td-border)] rounded-md bg-white text-zinc-600 hover:text-red-600 hover:border-red-200 transition-all text-[10px] font-bold uppercase tracking-widest shadow-sm"
                  >
                    <LogOut size={11} />
                    Exit
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-1 border border-red-200 rounded-md bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all text-[10px] font-bold uppercase tracking-widest shadow-sm"
                >
                  <UserIcon size={12} /> Login
                </button>
              )}
              <div className="flex items-center gap-2 bg-white border border-[var(--td-border)] rounded-md p-1 shadow-sm">
                <Globe className="text-zinc-500 w-4 h-4 ml-2" />
                <button onClick={() => setLang('cn')} className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-all rounded ${lang === 'cn' ? 'bg-red-100 text-red-700' : 'text-zinc-500 hover:text-zinc-800'}`}>CN</button>
                <button onClick={() => setLang('en')} className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-all rounded ${lang === 'en' ? 'bg-red-100 text-red-700' : 'text-zinc-500 hover:text-zinc-800'}`}>EN</button>
              </div>
            </div>
          </header>

          <section className="bg-[var(--td-surface-1)] border border-[var(--td-border)] p-8 rounded-lg relative overflow-hidden group min-h-[600px] flex flex-col shadow-sm ring-1 ring-[var(--td-ring)]">
            <textarea 
              className="flex-1 w-full bg-zinc-50 border border-[var(--td-border)] p-8 min-h-[280px] text-base leading-relaxed font-sans text-zinc-800 outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100 transition-all resize-none mb-8 rounded-md placeholder:text-zinc-500 md:text-lg"
              placeholder={lang === 'cn' ? "请在此粘贴长篇大论的官方通稿..." : "Paste the official narrative here..."}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isSubmitting}
            />
            <button 
              onClick={handleStart}
              disabled={!input.trim() || isSubmitting}
              className={`w-full py-8 text-xl font-bold uppercase tracking-[0.35em] flex items-center justify-center gap-4 transition-all border rounded-md ${
                !input.trim() || isSubmitting
                  ? 'bg-white border-2 border-zinc-300 text-zinc-600 cursor-not-allowed shadow-sm'
                  : 'bg-red-600 border-red-600 text-white hover:bg-red-700 shadow-md'
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
                  className="mt-6 p-5 bg-red-50 border border-red-200 flex items-start gap-4 rounded-md"
                >
                  <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={18} />
                  <div>
                    <h4 className="text-[10px] font-mono text-red-700 uppercase tracking-widest mb-1.5 font-bold">System Fault / 引擎驳回</h4>
                    <p className="text-sm text-red-800 font-mono leading-relaxed">{error}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>

        <div className="lg:col-span-5 flex flex-col bg-[var(--td-surface-2)] border border-[var(--td-border)] rounded-lg p-6 h-[90vh] shadow-sm ring-1 ring-[var(--td-ring)]">
          <div className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-zinc-300">
            <AnimatePresence mode='popLayout'>
              {feed.map((item) => (
                <motion.div 
                  key={item.id}
                  layout
                  onClick={() => router.push(`/decode/${item.id}`)}
                  className="group relative bg-white border border-zinc-200/80 p-6 rounded-md shadow-sm ring-1 ring-zinc-950/5 transition-all cursor-pointer overflow-hidden active:scale-[0.98] hover:shadow-md hover:ring-zinc-950/10"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-red-500/40 opacity-60 group-hover:opacity-100 transition-opacity rounded-l-md" />
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm font-bold text-zinc-600 group-hover:text-zinc-900 transition-colors italic line-clamp-2 flex-1 min-w-0">
                      {`"${item.metadata?.bilingual?.[lang] || item.verdict}"`}
                    </p>
                    {item.metadata?.intelProfile ? (
                      <IntelProfileMiniBars
                        scores={item.metadata.intelProfile.radar}
                        lockedKeys={user ? emptyIntelLockedKeys() : guestIntelLockedKeys()}
                        lang={lang}
                      />
                    ) : null}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {hasMore && !isInitialLoading && (
              <button onClick={() => fetchFeed(true)} className="w-full py-4 text-[10px] text-[var(--td-text-secondary)] uppercase font-mono hover:text-red-600 transition-colors">Access Historical Intel</button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
