"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, Sparkles, Loader2, AlertTriangle, Globe, User as UserIcon, LogOut, Crown } from 'lucide-react';
import AuthModal from '@/components/features/auth/AuthModal'; 
import { createClient } from '@/lib/supabase/client';
import { SignalRecord } from '@/types/database';
import { IntelProfileMiniBars } from '@/components/features/decode/IntelProfileRadar';
import { emptyIntelLockedKeys, guestIntelLockedKeys } from '@/lib/intel-profile-ui';
import { useGlobalLang } from '@/hooks/useGlobalLang';
import { type Session, type User } from '@supabase/supabase-js';
import DossierQuotaStrip from '@/components/features/decode/DossierQuotaStrip';
import type { DossierQuotaPublic } from '@/lib/dossier-quota';

/**
 * 当 ingest SSE 截断导致 JSON.parse 失败或 fluff 未被正则救回时，
 * 从原始拼接串中按契约「词汇::解析」启发式提取 cn 侧 fluff，用于恢复左侧红字气泡。
 */
/** Feed 卡片：体征已落盘且非补全中，才显示「就绪」观感 */
function isSignalIntelReady(item: SignalRecord): boolean {
  const m = item.metadata;
  if (!m || typeof m !== 'object') return false;
  if (!m.intelProfile) return false;
  return (m as { enrichmentPending?: boolean }).enrichmentPending !== true;
}

function extractFluffCnFromBrokenJsonBlob(blob: string): string[] {
  const fluffIdx = blob.indexOf('"fluff"');
  const slice =
    fluffIdx >= 0
      ? blob.slice(fluffIdx, Math.min(blob.length, fluffIdx + 150_000))
      : blob;
  const re = /"((?:[^"\\]|\\.)*::(?:[^"\\]|\\.)*)"/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(slice)) !== null) {
    const inner = m[1].replace(/\\n/g, ' ').replace(/\\"/g, '"');
    if (inner.includes('::') && inner.length >= 10) {
      out.push(inner);
    }
  }
  return [...new Set(out)].slice(0, 24);
}

export default function HomePage() {
  const router = useRouter();
  const { lang, setLang } = useGlobalLang();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false); 
  const [user, setUser] = useState<User | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      setUser(currentUser);
    };
    void getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        setUser(session?.user ?? null);
      }
    );
    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  // 🔧 新增：退出登录处理函数
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const handleUpgradePro = async () => {
    if (!user) {
      setIsAuthModalOpen(true);
      setError(
        lang === 'cn'
          ? '请先登录，再订阅 Pro。'
          : 'Please sign in before subscribing to Pro.'
      );
      return;
    }
    setCheckoutLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as {
        success?: boolean;
        data?: { url?: string | null };
        error?: string;
      };
      if (json.success && json.data?.url) {
        window.location.href = json.data.url;
      } else {
        setError(json.error || (lang === 'cn' ? '无法创建支付会话' : 'Checkout failed'));
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      setError(errMsg);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<SignalRecord[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [dossierQuota, setDossierQuota] = useState<DossierQuotaPublic | null>(
    null
  );
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    fetchFeed();
  }, []);

  useEffect(() => {
    if (!user) {
      setIsPro(false);
      setDossierQuota(null);
      return;
    }
    void fetch('/api/me/entitlements', { credentials: 'include' })
      .then((r) => r.json())
      .then(
        (j: {
          success?: boolean;
          data?: { isPro?: boolean; dossierQuota?: DossierQuotaPublic };
        }) => {
          if (j.success && j.data && typeof j.data.isPro === 'boolean') {
            setIsPro(j.data.isPro);
          } else {
            setIsPro(false);
          }
          if (j.success && j.data?.dossierQuota) {
            setDossierQuota(j.data.dossierQuota);
          } else {
            setDossierQuota(null);
          }
        }
      )
      .catch(() => {
        setIsPro(false);
        setDossierQuota(null);
      });
  }, [user]);

  /**
   * Stripe 支付成功回跳：若有 session_id 则先 confirm-session 写库（Webhook 兜底），再拉权益并清 query。
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('billing') !== 'success') return;
    const checkoutSessionId = sp.get('session_id');
    void (async () => {
      try {
        if (checkoutSessionId) {
          const confirmRes = await fetch('/api/billing/confirm-session', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: checkoutSessionId }),
          });
          if (process.env.NODE_ENV === 'development' && !confirmRes.ok) {
            const errJson = (await confirmRes.json().catch(() => ({}))) as {
              code?: string;
            };
            console.log(
              '🟡 [billing] confirm-session:',
              confirmRes.status,
              errJson.code ?? ''
            );
          }
        }
        const r = await fetch('/api/me/entitlements', { credentials: 'include' });
        const j = (await r.json()) as {
          success?: boolean;
          data?: { isPro?: boolean; dossierQuota?: DossierQuotaPublic };
        };
        if (j.success && j.data && typeof j.data.isPro === 'boolean') {
          setIsPro(j.data.isPro);
        }
        if (j.success && j.data?.dossierQuota) {
          setDossierQuota(j.data.dossierQuota);
        }
      } finally {
        router.replace('/');
      }
    })();
  }, [user, router]);

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

    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();
    if (!sessionUser) {
      setIsAuthModalOpen(true);
      setError(
        lang === 'cn'
          ? '请先登录后再提交解析，以保护接口与成本。'
          : 'Please sign in before decoding.'
      );
      return;
    }

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
        },
        credentials: 'include',
        body: JSON.stringify({ rawContent: input }),
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
              } catch {
                /* 忽略流碎片解析异常 */
              }
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
      } catch {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔴 [模块_崩溃] -> JSON 结构损毁或截断，启动正则暴力抢救...');
        } 
        
        intel = { 
          verdict: {
            cn: "数据流不稳定，已启用物理层抢救协议，部分核心逻辑可能遗失。",
            en: "",
          },
          facts: { cn: [] as string[], en: [] as string[] },
          fluff: { cn: [] as string[], en: [] as string[] },
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

      const cnFluffEarly = intel?.fluff?.cn;
      if (!Array.isArray(cnFluffEarly) || cnFluffEarly.length === 0) {
        const recovered = extractFluffCnFromBrokenJsonBlob(cleanedJsonString);
        if (recovered.length > 0) {
          intel = {
            ...intel,
            fluff: {
              cn: recovered,
              en: Array.isArray(intel?.fluff?.en) ? intel.fluff.en : [],
            },
          };
        }
      }

      const saveRes = await fetch('/api/v1/ingest/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ rawContent: input, intel }),
      }); 

      const saveJson = await saveRes.json(); 

      if (saveJson.success && saveJson.data?.signalId) {
        const sid = saveJson.data.signalId as string;
        if (process.env.NODE_ENV === 'development') {
          console.log('🔵 [模块_成功] -> 产物 ID:', sid);
        }
        /** 链式触发 enrich（intel → profile），失败时短暂重试一次，提高体征与脚注落盘成功率 */
        if (saveJson.data.enrichmentRequired !== false) {
          void (async () => {
            const opts: RequestInit = {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
            };
            const fetchWithTimeout = async (
              url: string,
              init: RequestInit,
              timeoutMs: number
            ): Promise<Response> => {
              const ac = new AbortController();
              const t = setTimeout(() => ac.abort(), timeoutMs);
              try {
                return await fetch(url, { ...init, signal: ac.signal });
              } finally {
                clearTimeout(t);
              }
            };
              const runOnce = async (): Promise<boolean> => {
              const intelRes = await fetchWithTimeout('/api/v1/ingest/enrich', {
                ...opts,
                body: JSON.stringify({ signalId: sid, step: 'intel' }),
              }, 15_000).catch(() => null);
              // 情报体征改异步队列：入队成功即可，由 Worker 长跑落盘
              const profileRes = await fetchWithTimeout('/api/v1/generation/jobs', {
                ...opts,
                body: JSON.stringify({
                  kind: 'intel_profile',
                  payload: { signalId: sid, forceRegenerate: false },
                }),
              }, 20_000).catch(() => null);
              const intelOk = Boolean(intelRes?.ok);
              const profileOk = Boolean(profileRes?.ok);
              return profileOk || intelOk;
            };
            let ok = await runOnce();
            if (!ok) {
              await new Promise((r) => setTimeout(r, 2800));
              ok = await runOnce();
            }
            if (!ok && process.env.NODE_ENV === 'development') {
              console.log('🔴 [模块_崩溃] -> ingest enrich 链两次均未成功，依赖解码页轮询与 cron 兜底');
            }
          })();
        }
        setInput('');
        router.prefetch(`/decode/${sid}`);
        router.push(`/decode/${sid}`);
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
                  {isPro ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 border border-amber-200 rounded-md bg-amber-50 text-amber-900 shadow-sm">
                      <Crown className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[10px] font-mono font-bold uppercase tracking-widest">
                        Pro
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleUpgradePro()}
                      disabled={checkoutLoading}
                      className="flex items-center gap-1.5 px-3 py-1 border border-amber-300 rounded-md bg-amber-50 text-amber-900 hover:bg-amber-100 text-[10px] font-bold uppercase tracking-widest shadow-sm disabled:opacity-50"
                    >
                      {checkoutLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Crown className="w-3.5 h-3.5" />
                      )}
                      {lang === 'cn' ? '升级 Pro' : 'Upgrade Pro'}
                    </button>
                  )}
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

          {user ? (
            <DossierQuotaStrip
              quota={dossierQuota}
              lang={lang}
              hasSession={!!user}
              className="mb-2"
            />
          ) : null}

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
                    <h4 className="text-[10px] font-mono text-red-700 uppercase tracking-widest mb-1.5 font-bold">{lang === 'cn' ? 'System Fault / 引擎驳回' : 'SYSTEM FAULT'}</h4>
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
                <motion.div key={item.id} layout className="relative">
                  <Link
                    href={`/decode/${item.id}`}
                    prefetch
                    scroll
                    className="group relative block bg-white border border-zinc-200/80 p-6 rounded-md shadow-sm ring-1 ring-zinc-950/5 transition-all cursor-pointer overflow-hidden active:scale-[0.98] hover:shadow-md hover:ring-zinc-950/10"
                  >
                    <div className="absolute top-0 left-0 w-1 h-full bg-red-500/40 opacity-60 group-hover:opacity-100 transition-opacity rounded-l-md" />
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0 space-y-2">
                        <p className="text-sm font-bold text-zinc-600 group-hover:text-zinc-900 transition-colors italic line-clamp-2">
                          {`"${item.metadata?.bilingual?.[lang] || item.verdict}"`}
                        </p>
                        {!isSignalIntelReady(item) ? (
                          <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-mono font-semibold uppercase tracking-wider text-amber-900">
                            {lang === 'cn' ? '体征补全中' : 'Intel loading'}
                          </span>
                        ) : null}
                      </div>
                      {item.metadata?.intelProfile ? (
                        <IntelProfileMiniBars
                          scores={item.metadata.intelProfile.radar}
                          lockedKeys={
                            user && isPro
                              ? emptyIntelLockedKeys()
                              : guestIntelLockedKeys()
                          }
                          lang={lang}
                        />
                      ) : null}
                    </div>
                  </Link>
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
