"use client";
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  Trash2,
  Zap,
  ShieldAlert,
  Globe,
  FileDown,
  ImageDown,
} from 'lucide-react';
import RawNarrative from '@/components/features/decode/RawNarrative';
import DossierReader from '@/components/features/decode/DossierReader';
import DossierQuotaStrip from '@/components/features/decode/DossierQuotaStrip';
import VerdictPanel from '@/components/features/decode/VerdictPanel';
import IntelProfilePanel from '@/components/features/decode/IntelProfilePanel';
import ChatTerminal from '@/components/features/terminal/ChatTerminal';
import AuthModal from '@/components/features/auth/AuthModal';
import { SignalRecord, BilingualData } from '@/types/database';
import type { IntelProfileError } from '@/types/intel-profile';
import { useGlobalLang } from '@/hooks/useGlobalLang';
import { useDossierStream } from '@/hooks/useDossierStream';
import { createClient } from '@/lib/supabase/client';
import type { Session } from '@supabase/supabase-js';
import {
  buildIntelExportBlocks,
  type IntelExportBlock,
} from '@/lib/intel-export-sections';
import { IntelExportHtmlMount } from '@/components/export/IntelExportHtmlMount';
import type { TerminalMessage } from '@/types';
import type { DossierQuotaPublic } from '@/lib/dossier-quota';

export default function DecodePage() {
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
  const [hasSession, setHasSession] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [dossierQuota, setDossierQuota] = useState<DossierQuotaPublic | null>(
    null
  );
  /** 与 Admin 面板一致：仅 NEXT_PUBLIC_ADMIN_EMAIL 可物理删除 signals */
  const [canPurgeSignals, setCanPurgeSignals] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pngExporting, setPngExporting] = useState(false);
  const [includeTerminalExport, setIncludeTerminalExport] = useState(false);
  const [terminalMessages, setTerminalMessages] = useState<TerminalMessage[]>(
    []
  );
  const [pngBlocks, setPngBlocks] = useState<IntelExportBlock[] | null>(null);
  const pngMountRef = useRef<HTMLDivElement>(null);

  const fetchEntitlementsForSession = useCallback(
    async (session: Session | null) => {
      setHasSession(!!session);
      if (!session) {
        setIsPro(false);
        setDossierQuota(null);
        setCanPurgeSignals(false);
        return;
      }
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL?.toLowerCase();
      const sessionEmail = session.user?.email?.toLowerCase();
      setCanPurgeSignals(
        !!adminEmail && !!sessionEmail && sessionEmail === adminEmail
      );
      try {
        const res = await fetch('/api/me/entitlements', {
          credentials: 'include',
        });
        // #region agent log
        if (res.status === 401) {
          fetch(
            'http://127.0.0.1:7242/ingest/0c753ea0-b6cf-4d53-95cb-28c61cb08775',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                location: 'decode/[id]/page.tsx:fetchEntitlements',
                message: 'entitlements 401 while client has session',
                data: {
                  hypothesisId: 'H4',
                  httpStatus: res.status,
                  clientHasSession: true,
                },
                timestamp: Date.now(),
                runId: 'pre-fix',
              }),
            }
          ).catch(() => {});
        }
        // #endregion
        const json = (await res.json()) as {
          success?: boolean;
          data?: {
            isPro?: boolean;
            dossierQuota?: DossierQuotaPublic;
          };
        };
        if (json.success && json.data && typeof json.data.isPro === 'boolean') {
          setIsPro(json.data.isPro);
        } else {
          setIsPro(false);
        }
        if (json.success && json.data?.dossierQuota) {
          setDossierQuota(json.data.dossierQuota);
        } else {
          setDossierQuota(null);
        }
      } catch {
        setIsPro(false);
        setDossierQuota(null);
      }
    },
    []
  );

  const { dossierContent, isStreamingDossier, isTruncated, streamQualityError, dossierRecoveryStatus, startDossierStream } = useDossierStream(
    signal,
    lang,
    {
      onQuotaExceeded: () => {
        void (async () => {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          await fetchEntitlementsForSession(session);
          setAuthContext({
            title: lang === 'cn' ? '卷宗次数已用尽' : 'DOSSIER QUOTA EXCEEDED',
            subtitle:
              lang === 'cn'
                ? '本月暗影卷宗次数已用完。订阅 Pro 可无限生成，或于下月（UTC）重置后再试。'
                : 'Monthly quota reached. Subscribe to Pro for unlimited dossiers, or try again next month (UTC).',
          });
          setIsAuthModalOpen(true);
        })();
      },
      onDossierSynced: () => {
        void (async () => {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          await fetchEntitlementsForSession(session);
        })();
      },
    }
  );

  useEffect(() => { 
     if (!id) return;
     const fetchSignal = async () => { 
       try { 
         const res = await fetch(`/api/decode?id=${id}`); 
         const json = await res.json(); 
         if (json.success) setSignal(json.data);
       } catch (err) { 
         if (process.env.NODE_ENV === 'development') {
           const errMsg = err instanceof Error ? err.message : String(err);
           console.log("🔴 [模块_崩溃] -> 原因: 信号抓取失败", errMsg); 
         }
       } finally { 
         setLoading(false); 
       } 
     }; 
 
     fetchSignal(); 
   }, [id]);

  /**
   * 登录态与 Pro 权益：情报全维用 intelUnlocked；导出能力用 canExport（均要求登录且 Pro，数据来自 /api/me/entitlements）。
   */
  useEffect(() => {
    void supabase.auth
      .getSession()
      .then(({ data }: { data: { session: Session | null } }) =>
        fetchEntitlementsForSession(data.session)
      );

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event: string, session: Session | null) => {
        void fetchEntitlementsForSession(session);
      }
    );
    return () => {
      sub.subscription.unsubscribe();
    };
  }, [supabase, fetchEntitlementsForSession]);

  const intelUnlocked = hasSession && isPro;
  const canExport = hasSession && isPro;

  useEffect(() => {
    if (signal && signal.raw_content) {
      const f = signal.fluff_words;

      // 🔧 核心修复 V2.0：同时读取 cn 和 en 两套词汇
      // 原逻辑只用 cnFluffs 的词作为 key，导致英文原文或 AI 输出词汇与原文不一致时气泡消失
      const cnFluffs = Array.isArray(f) ? f : (f as BilingualData)?.['cn'] || [];
      const enFluffs = Array.isArray(f) ? [] : (f as BilingualData)?.['en'] || [];
      const targetFluffs = Array.isArray(f) ? f : (f as BilingualData)?.[lang] || [];

      const INVALID_KEYS = ['原文', '原文提取词汇', 'EnglishWord', '词汇', '提取词汇'];

      // 通用解析函数：从一条 fluff 字符串中提取 key（词）和 explanation（解释）
      const parseFluffItem = (
        item: string,
        explanationSource: string
      ): { key: string; explanation: string } | null => {
        if (!item || typeof item !== 'string') return null;

        let key = '';
        let explanation = '';

        const parts = item.split(/(?:::|：：)/);

        if (parts.length >= 2) {
          // 标准格式：「词汇::解析」
          key = parts[0].replace(/[「」"""'*\[\]]/g, '').trim();
          const targetParts = explanationSource.split(/(?:::|：：)/);
          explanation = targetParts.length >= 2
            ? targetParts.slice(1).join("::").trim()
            : explanationSource;
        } else {
          // 降级格式：「词汇【解析...」
          const bracketMatch = item.match(/[【\[]/);
          if (bracketMatch && bracketMatch.index !== undefined && bracketMatch.index > 0) {
            key = item.substring(0, bracketMatch.index).replace(/[「」"""'*\[\]]/g, '').trim();
            const targetBracketMatch = explanationSource.match(/[【\[]/);
            if (targetBracketMatch && targetBracketMatch.index !== undefined && targetBracketMatch.index > 0) {
              explanation = explanationSource.substring(targetBracketMatch.index).trim();
            } else {
              explanation = explanationSource;
            }
          }
        }

        if (key.length < 2 || INVALID_KEYS.includes(key)) return null;
        return { key, explanation };
      };

      const dict: Record<string, string> = {};

      // 第一轮：注册 cn 词汇（对中文原文命中）
      cnFluffs.forEach((item, idx) => {
        // EN 模式语种隔离守卫：如果没有对应的 EN 解释（targetFluffs[idx] 为空），
        // 跳过此条 CN 词条，绝不允许 CN 解释渗入 EN 模式的词典导致气泡弹出中文。
        if (lang === 'en' && !targetFluffs[idx]) return;

        const targetItem = targetFluffs[idx] || item;
        const parsed = parseFluffItem(item, targetItem);
        if (!parsed) {
          if (process.env.NODE_ENV === 'development') {
            console.log('🟡 [模块_异步] -> 拦截废弃/幻觉 cn Key:', item);
          }
          return;
        }
        if (!dict[parsed.key]) {
          dict[parsed.key] = parsed.explanation;
          if (process.env.NODE_ENV === 'development') {
            console.log('🟢 [模块_发起] -> 加载 cn 词汇:', parsed.key);
          }
        } else if (process.env.NODE_ENV === 'development') {
          console.log('🟡 [模块_异步] -> cn Key 重复，已物理丢弃:', parsed.key);
        }
      });

      // 🔧 第二轮：额外注册 en 词汇（对英文原文命中，同时兜底爬虫抓取的英文新闻）
      // explanation 始终使用当前语言对应的解释，保证显示内容正确
      enFluffs.forEach((item, idx) => {
        // en key 的解释：优先用当前语言的 targetFluffs，没有则用自身
        const targetItem = targetFluffs[idx] || item;
        const parsed = parseFluffItem(item, targetItem);
        if (!parsed) return;
        if (!dict[parsed.key]) {
          dict[parsed.key] = parsed.explanation;
          if (process.env.NODE_ENV === 'development') {
            console.log('🟢 [模块_发起] -> 加载 en 词汇:', parsed.key);
          }
        } else if (process.env.NODE_ENV === 'development') {
          console.log('🟡 [模块_异步] -> en Key 重复，已物理丢弃:', parsed.key);
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
    if (
      dossierQuota &&
      !dossierQuota.isUnlimited &&
      dossierQuota.remaining <= 0
    ) {
      setAuthContext({
        title: lang === 'cn' ? '卷宗次数已用尽' : 'DOSSIER QUOTA EXCEEDED',
        subtitle:
          lang === 'cn'
            ? '本月暗影卷宗次数已用完。订阅 Pro 可无限生成，或于下月（UTC）重置后再试。'
            : 'Monthly quota reached. Subscribe to Pro for unlimited dossiers, or try again next month (UTC).',
      });
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
      const res = await fetch(`/api/v1/delete?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        router.push('/');
      } else {
        alert(`抹杀失败: ${json.error}`);
      }
    } catch (_e) { 
      alert("网络阻断");
    } finally { 
      setIsDeleting(false);
    }
  };

  const requireSessionForExport = async (): Promise<boolean> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setAuthContext({
        title: lang === 'cn' ? '导出未解锁' : 'EXPORT LOCKED',
        subtitle:
          lang === 'cn'
            ? '登录后可导出 PDF 与完整长图（含原文与卷宗）。'
            : 'Sign in to export PDF and full-length image (source + dossier).',
      });
      setIsAuthModalOpen(true);
      return false;
    }
    return true;
  };

  /**
   * 导出 PDF/长图：先登录，再校验 Pro；与情报面板的「需要 Pro」文案保持一致。
   */
  const assertExportAllowed = async (): Promise<boolean> => {
    if (!(await requireSessionForExport())) return false;
    if (!isPro) {
      setAuthContext({
        title: lang === 'cn' ? '需要 Pro' : 'PRO REQUIRED',
        subtitle:
          lang === 'cn'
            ? '订阅 Pro 解锁完整情报体征、利益沙盘与核验清单。请返回首页点击「升级 Pro」。'
            : 'Subscribe to Pro for full intel. Use “Upgrade Pro” on the home page.',
      });
      setIsAuthModalOpen(true);
      return false;
    }
    return true;
  };

  const handleExportPdf = async () => {
    if (!signal) return;
    if (!(await assertExportAllowed())) return;
    setPdfExporting(true);
    try {
      const res = await fetch('/api/v1/export/pdf', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          lang,
          includeTerminal: includeTerminalExport,
          terminalMessages: includeTerminalExport ? terminalMessages : [],
          dossierText: dossierContent || null,
        }),
      });
      if (!res.ok) {
        const ct = res.headers.get('content-type');
        if (ct?.includes('application/json')) {
          const j = (await res.json()) as { error?: string; code?: string };
          throw new Error(
            j.error || j.code || res.statusText || 'PDF export failed'
          );
        }
        const errText = await res.text();
        throw new Error(errText || res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TruthDecoder-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'PDF export failed';
      alert(msg);
    } finally {
      setPdfExporting(false);
    }
  };

  const handleExportPngClick = async () => {
    if (!signal) return;
    if (!(await assertExportAllowed())) return;
    setPngExporting(true);
    const blocks = buildIntelExportBlocks(signal, lang, {
      mode: 'full',
      dossierText: dossierContent || null,
      includeTerminal: includeTerminalExport,
      terminalMessages: includeTerminalExport ? terminalMessages : [],
    });
    setPngBlocks(blocks);
  };

  useLayoutEffect(() => {
    if (!pngBlocks) return;

    let cancelled = false;

    void (async () => {
      await document.fonts.ready;
      await new Promise((r) => setTimeout(r, 60));
      const el = pngMountRef.current;
      if (!el || cancelled) {
        setPngBlocks(null);
        setPngExporting(false);
        return;
      }
      try {
        const html2canvas = (await import('html2canvas')).default;
        const h = el.scrollHeight;
        const w = el.scrollWidth;
        if (h > 16000) {
          throw new Error('CANVAS_TOO_TALL');
        }
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          logging: false,
          width: w,
          height: h,
          windowHeight: h,
          windowWidth: w,
          scrollX: 0,
          scrollY: 0,
        });
        await new Promise<void>((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (!blob || cancelled) {
                reject(new Error('blob'));
                return;
              }
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `TruthDecoder-${id}-full.png`;
              a.click();
              URL.revokeObjectURL(url);
              resolve();
            },
            'image/png',
            1
          );
        });
      } catch (e: unknown) {
        if (process.env.NODE_ENV === 'development') {
          const errMsg = e instanceof Error ? e.message : String(e);
          console.log('🔴 [模块_崩溃] -> 长图导出:', errMsg);
        }
        alert(
          lang === 'cn'
            ? '长图生成失败（内容过长可能超出浏览器画布上限），请改用导出 PDF。'
            : 'Long image failed (browser canvas limits). Please use PDF export.'
        );
      } finally {
        if (!cancelled) {
          setPngBlocks(null);
          setPngExporting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pngBlocks, id, lang]);

  if (loading) return <div className="min-h-screen bg-[var(--td-surface-0)] flex items-center justify-center"><Loader2 className="animate-spin text-red-600 w-10 h-10" /></div>;
  if (!signal) return <div className="min-h-screen bg-[var(--td-surface-0)] flex flex-col items-center justify-center"><AlertCircle className="text-red-600 w-12 h-12 mb-4" /><h2 className="text-[var(--td-text-secondary)] font-mono text-sm uppercase">Signal Erased</h2></div>;

  const h = signal.hard_facts;
  const currentHardFacts = Array.isArray(h) ? h : (h as BilingualData)?.[lang] || [];

  return (
    <main className="min-h-screen bg-[var(--td-surface-0)] text-zinc-800 font-sans pb-24">
      {pngBlocks ? (
        <IntelExportHtmlMount ref={pngMountRef} blocks={pngBlocks} />
      ) : null}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} title={authContext.title} subtitle={authContext.subtitle} />
      <div className="max-w-[1600px] mx-auto px-6">
        <header className="py-8 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--td-border)] mb-8">
          <button onClick={() => router.push('/')} className="flex items-center gap-3 text-zinc-500 hover:text-red-600 transition-all"><ArrowLeft size={16} /><span className="text-xs font-mono uppercase tracking-widest">Index</span></button>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:flex-wrap sm:gap-2">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="shrink-0 rounded border border-red-200 px-1 text-[9px] font-bold text-red-600">
                    {lang === 'cn' ? 'Pro 专属' : 'PRO'}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleExportPdf()}
                      disabled={pdfExporting}
                      className={`flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest border border-zinc-200 bg-white text-zinc-700 hover:border-red-300 hover:text-red-700 rounded-md shadow-sm transition-all disabled:opacity-50 ${!canExport ? 'opacity-60 cursor-pointer' : ''}`}
                    >
                      {pdfExporting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FileDown className="w-3.5 h-3.5" />
                      )}
                      {lang === 'cn' ? '导出 PDF' : 'Export PDF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleExportPngClick()}
                      disabled={pngExporting}
                      className={`flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest border border-zinc-200 bg-white text-zinc-700 hover:border-red-300 hover:text-red-700 rounded-md shadow-sm transition-all disabled:opacity-50 ${!canExport ? 'opacity-60 cursor-pointer' : ''}`}
                    >
                      {pngExporting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ImageDown className="w-3.5 h-3.5" />
                      )}
                      {lang === 'cn' ? '导出长图' : 'Export image'}
                    </button>
                  </div>
                </div>
                {!canExport ? (
                  <p className="text-[10px] font-mono text-zinc-500 pl-0 sm:pl-0 max-w-[min(100%,28rem)]">
                    {lang === 'cn'
                      ? '仅 Pro 会员可使用导出 PDF 与长图。'
                      : 'Pro subscription required for PDF and image export.'}
                  </p>
                ) : null}
              </div>
              <label
                className={`flex items-center gap-2 text-[10px] font-mono text-zinc-600 select-none ${canExport ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
              >
                <input
                  type="checkbox"
                  className="rounded border-zinc-300 disabled:cursor-not-allowed"
                  checked={includeTerminalExport}
                  disabled={!canExport}
                  onChange={(e) => setIncludeTerminalExport(e.target.checked)}
                />
                <span>
                  {lang === 'cn'
                    ? '包含终端对话（当前页面会话）'
                    : 'Include terminal (this session)'}
                </span>
              </label>
            </div>
            <div className="flex items-center gap-2 bg-white border border-[var(--td-border)] rounded-md p-1 shadow-sm">
              <Globe className="text-zinc-500 w-4 h-4 ml-2" />
              <button onClick={() => setLang('cn')} className={`px-4 py-1.5 text-[10px] font-bold transition-all rounded ${lang === 'cn' ? 'bg-red-100 text-red-700' : 'text-zinc-500 hover:text-zinc-800'}`}>CN</button>
              <button onClick={() => setLang('en')} className={`px-4 py-1.5 text-[10px] font-bold transition-all rounded ${lang === 'en' ? 'bg-red-100 text-red-700' : 'text-zinc-500 hover:text-zinc-800'}`}>EN</button>
            </div>
            {canPurgeSignals ? (
              <button onClick={handlePurge} disabled={isDeleting} className="group flex items-center justify-center w-9 h-9 bg-white border border-zinc-200 hover:border-red-300 hover:bg-red-50 transition-all rounded-md disabled:opacity-50 shadow-sm" title="Purge"><Trash2 size={16} className="text-zinc-500 group-hover:text-red-600" /></button>
            ) : null}
          </div>
        </header>

        <section className="mb-10"><VerdictPanel verdict={(signal.metadata?.bilingual?.[lang] || signal.verdict) as string} isErased={true} /></section>

        <IntelProfilePanel
          profile={signal.metadata?.intelProfile}
          profileError={signal.metadata?.intelProfileError as IntelProfileError | undefined}
          lang={lang}
          unlocked={intelUnlocked}
          onRequireAuth={() => {
            void (async () => {
              const {
                data: { session },
              } = await supabase.auth.getSession();
              if (!session) {
                setAuthContext({
                  title: lang === 'cn' ? '体征未解锁' : 'PROFILE LOCKED',
                  subtitle:
                    lang === 'cn'
                      ? '登录后可查看完整情报体征；订阅 Pro 解锁全部维度。'
                      : 'Sign in to use intel signature; subscribe to Pro for all dimensions.',
                });
                setIsAuthModalOpen(true);
                return;
              }
              setAuthContext({
                title: lang === 'cn' ? '需要 Pro' : 'PRO REQUIRED',
                subtitle:
                  lang === 'cn'
                    ? '订阅 Pro 解锁完整情报体征、利益沙盘与核验清单。请返回首页点击「升级 Pro」。'
                    : 'Subscribe to Pro for full intel. Use “Upgrade Pro” on the home page.',
              });
              setIsAuthModalOpen(true);
            })();
          }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5 sticky top-8">
             <RawNarrative rawContent={signal.raw_content} lang={lang} dictionary={dictionary} />
          </div>
          <div className="lg:col-span-7 flex flex-col gap-3">
            <DossierQuotaStrip
              quota={dossierQuota}
              lang={lang}
              hasSession={hasSession}
              className="shrink-0"
            />
            {!dossierContent && !isStreamingDossier ? (
              <div className="bg-[var(--td-surface-1)] border border-[var(--td-border)] p-20 flex flex-col items-center justify-center text-center rounded-lg h-[600px] shadow-sm ring-1 ring-[var(--td-ring)] relative">
                <ShieldAlert className="w-16 h-16 text-zinc-300 mb-6" />
                <button onClick={handleDossierClick} className="group relative bg-red-600 border border-red-600 text-white hover:bg-red-700 transition-all px-10 py-5 font-semibold tracking-wide text-sm flex items-center gap-3 rounded-md shadow-md">
                  <Zap size={18} className="group-hover:animate-pulse" />
                  <span>{lang === 'cn' ? '生成卷宗' : 'Generate dossier'}</span>
                </button>
              </div>
            ) : ( 
              <DossierReader 
                content={dossierContent} 
                isStreaming={isStreamingDossier} 
                isTruncated={isTruncated} 
                qualityError={streamQualityError}
                recoveryHint={dossierRecoveryStatus}
                dictionary={dictionary} 
              /> 
            )}
          </div>
        </div>

        <div className="mt-12 border-t border-[var(--td-border)] pt-12">
          <ChatTerminal
            signalId={id}
            hardFacts={currentHardFacts}
            onRequireAuth={() => {
              setAuthContext({
                title: 'QUOTA EXCEEDED',
                subtitle: '登录以解除频率限制。',
              });
              setIsAuthModalOpen(true);
            }}
            onMessagesChange={setTerminalMessages}
          />
        </div>
      </div>
    </main>
  );
}