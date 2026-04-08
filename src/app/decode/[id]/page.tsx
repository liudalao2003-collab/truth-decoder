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
import { AnimatePresence, motion } from 'framer-motion';
import RawNarrative from '@/components/features/decode/RawNarrative';
import DossierReader from '@/components/features/decode/DossierReader';
import DossierQuotaStrip from '@/components/features/decode/DossierQuotaStrip';
import VerdictPanel from '@/components/features/decode/VerdictPanel';
import IntelProfilePanel from '@/components/features/decode/IntelProfilePanel';
import ChatTerminal from '@/components/features/terminal/ChatTerminal';
import TerminalQuotaStrip from '@/components/features/terminal/TerminalQuotaStrip';
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
import type { TerminalQuotaPublic } from '@/lib/terminal-quota';
import { hasChinese } from '@/utils/text-stream-guard';
import { useBilingualCache } from '@/hooks/useBilingualCache';

const DICT_CACHE_VERSION = 'v1';

function dictCacheKey(signalId: string, lang: 'cn' | 'en'): string {
  return `td_dict_${DICT_CACHE_VERSION}_${signalId}_${lang}`;
}


/** 消费 /api/v1/translate 的 SSE，拼出完整译文 */
async function readTranslateSseToText(
  body: ReadableStream<Uint8Array>
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let lineBuffer = '';
  let acc = '';
  let streamDone = false;
  while (!streamDone) {
    const { value, done: rDone } = await reader.read();
    streamDone = rDone;
    if (value) {
      lineBuffer += decoder.decode(value, { stream: true });
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ') && !trimmed.includes('[DONE]')) {
          try {
            const data = JSON.parse(trimmed.slice(6)) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            acc += data.choices?.[0]?.delta?.content ?? '';
          } catch {
            /* 忽略流碎片 */
          }
        }
      }
    }
  }
  return acc;
}

function parseFnBlocksTranslated(markdown: string, count: number): string[] {
  const out: string[] = Array.from({ length: count }, () => '');
  const re = /\[\[FN_BLOCK:(\d+)\]\]([\s\S]*?)\[\[\/FN_BLOCK\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    const i = parseInt(m[1], 10);
    if (i >= 0 && i < count) out[i] = m[2].trim();
  }
  return out;
}

/** EN 模式下缺失 fluff.en 时，批量将中文解释段译为英文并映射回 key */
async function translateFluffTailsToEnglish(
  pending: { key: string; tailCn: string }[]
): Promise<Record<string, string>> {
  if (pending.length === 0) return {};
  const blocks = pending.map(
    (p, i) => `[[FN_BLOCK:${i}]]\n${p.tailCn}\n[[/FN_BLOCK]]`
  );
  const content = `Translate all Chinese inside FN_BLOCK markers into fluent English. Each block's inner text MUST be entirely English with zero Chinese characters. Preserve every [[FN_BLOCK:n]] and [[/FN_BLOCK]] tag exactly; only translate the inner text.\n\n${blocks.join('\n\n')}`;
  const res = await fetch('/api/v1/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ content, targetLang: 'en' }),
  });
  if (!res.ok || !res.body) return {};
  const full = await readTranslateSseToText(res.body);
  const parts = parseFnBlocksTranslated(full, pending.length);
  const map: Record<string, string> = {};
  pending.forEach((p, i) => {
    if (parts[i]) map[p.key] = parts[i];
  });
  return map;
}

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
  const enrichSelfHealAttemptRef = useRef(0);
  /** 防止自愈退避与手动重算同时对同一 signal 并发打 profile，烧穿 LLM 预算 */
  const profileEnrichInFlightRef = useRef(false);
  const [isRetryingProfile, setIsRetryingProfile] = useState(false);
  const [profileRetryCooldownSec, setProfileRetryCooldownSec] = useState(0);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authContext, setAuthContext] = useState({ title: '', subtitle: '' });
  const [hasSession, setHasSession] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [dossierQuota, setDossierQuota] = useState<DossierQuotaPublic | null>(
    null
  );
  const [terminalQuota, setTerminalQuota] = useState<TerminalQuotaPublic | null>(
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
        setTerminalQuota(null);
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
        const json = (await res.json()) as {
          success?: boolean;
          data?: {
            isPro?: boolean;
            dossierQuota?: DossierQuotaPublic;
            terminalQuota?: TerminalQuotaPublic;
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
        if (json.success && json.data?.terminalQuota) {
          setTerminalQuota(json.data.terminalQuota);
        } else {
          setTerminalQuota(null);
        }
      } catch {
        setIsPro(false);
        setDossierQuota(null);
        setTerminalQuota(null);
      }
    },
    []
  );

  const { dossierContent, isStreamingDossier, isTranslating: isDossierTranslating, isTruncated, streamQualityError, dossierRecoveryStatus, startDossierStream } = useDossierStream(
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
  const { resolveOrCreate: resolveFluffCache } = useBilingualCache(signal?.id ?? null, 'fluff');

  // 🚀 进入解码页即恢复本地缓存 dictionary（若存在），让历史资产秒开红泡
  useEffect(() => {
    if (!id) return;
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(dictCacheKey(id, lang));
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        setDictionary(parsed);
      }
    } catch {
      /* ignore */
    }
  }, [id, lang]);

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

  // 切换 decode 目标时重置自愈计数与飞行锁，避免跨 ID 串线
  useEffect(() => {
    enrichSelfHealAttemptRef.current = 0;
    profileEnrichInFlightRef.current = false;
  }, [id]);

  /** 入库后异步补全（enrich）期间轮询刷新，体征与脚注在后台落盘后可无刷新呈现 */
  const pendingEnrichment =
    Boolean(
      signal?.metadata &&
        typeof signal.metadata === 'object' &&
        (signal.metadata as { enrichmentPending?: boolean }).enrichmentPending === true
    );

  useEffect(() => {
    if (profileRetryCooldownSec <= 0) return;
    const t = setInterval(() => {
      setProfileRetryCooldownSec((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(t);
  }, [profileRetryCooldownSec]);

  const handleRetryProfile = useCallback(() => {
    if (!id) return;
    if (profileRetryCooldownSec > 0 || isRetryingProfile) return;
    setIsRetryingProfile(true);
    profileEnrichInFlightRef.current = true;
    setProfileRetryCooldownSec(30);
    void (async () => {
      const ac = new AbortController();
      // 与 ingest/enrich profile 硬熔断（108s）及路由 maxDuration 对齐，避免客户端提前 Abort
      const timer = setTimeout(() => ac.abort(), 118_000);
      try {
        await fetch('/api/v1/ingest/enrich', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          // 质量重算：即使已有体征，也强制发起新一轮生成。
          body: JSON.stringify({ signalId: id, step: 'profile', forceRegenerate: true }),
          signal: ac.signal,
        });
      } catch {
        /* 静默：下次可继续手动重试 */
      } finally {
        clearTimeout(timer);
        profileEnrichInFlightRef.current = false;
      }

      try {
        const res = await fetch(`/api/decode?id=${id}`);
        const json = (await res.json()) as { success?: boolean; data?: SignalRecord };
        if (json.success && json.data) {
          setSignal(json.data);
        }
      } catch {
        /* ignore */
      } finally {
        setIsRetryingProfile(false);
      }
    })();
  }, [id, isRetryingProfile, profileRetryCooldownSec]);

  // 🛡️ 自愈补全：Vercel 偶发 504 会导致 enrichmentPending 被卡死；解码页按退避策略补打 profile
  useEffect(() => {
    if (!id || !pendingEnrichment) return;
    if (isRetryingProfile || profileEnrichInFlightRef.current) return;
    const m = signal?.metadata as { intelProfile?: unknown; enrichmentPending?: boolean } | undefined;
    if (m?.intelProfile) return;
    const attempt = enrichSelfHealAttemptRef.current;
    const delays = [3800, 10000, 25000];
    if (attempt >= delays.length) return;

    // 延迟重试：先让轮询跑，再按指数退避补火，避免瞬时风暴
    const t = setTimeout(() => {
      if (profileEnrichInFlightRef.current || isRetryingProfile) return;
      profileEnrichInFlightRef.current = true;
      enrichSelfHealAttemptRef.current = attempt + 1;
      void fetch('/api/v1/ingest/enrich', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId: id, step: 'profile' }),
      })
        .catch(() => {
          /* 静默：轮询与 cron 仍可兜底 */
        })
        .finally(() => {
          profileEnrichInFlightRef.current = false;
        });
    }, delays[attempt]);

    return () => clearTimeout(t);
  }, [id, pendingEnrichment, signal?.metadata, isRetryingProfile]);

  useEffect(() => {
    if (!id || !pendingEnrichment) return;
    let cancelled = false;
    let ticks = 0;
    const maxTicks = 40;
    const intervalMs = 3500;
    const timer = setInterval(() => {
      void (async () => {
        ticks += 1;
        if (cancelled || ticks > maxTicks) {
          clearInterval(timer);
          return;
        }
        try {
          const res = await fetch(`/api/decode?id=${id}`);
          const json = (await res.json()) as {
            success?: boolean;
            data?: SignalRecord;
          };
          if (!json.success || !json.data || cancelled) return;
          setSignal(json.data);
          const still =
            (json.data.metadata as { enrichmentPending?: boolean } | undefined)?.enrichmentPending === true;
          if (!still) {
            clearInterval(timer);
          }
        } catch {
          /* 静默 */
        }
      })();
    }, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id, pendingEnrichment]);

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
        const enLine = enFluffs[idx];
        let targetItem: string;
        if (lang === 'en' && enLine?.trim()) {
          targetItem = enLine;
        } else {
          targetItem = targetFluffs[idx] || item;
        }
        const parsed = parseFluffItem(item, targetItem);
        if (!parsed) {
          if (process.env.NODE_ENV === 'development') {
            console.log('🟡 [模块_异步] -> 拦截废弃/幻觉 cn Key:', item);
          }
          return;
        }
        const nk = parsed.key.normalize('NFC');
        if (!dict[nk]) {
          dict[nk] = parsed.explanation;
          if (process.env.NODE_ENV === 'development') {
            console.log('🟢 [模块_发起] -> 加载 cn 词汇:', nk);
          }
        } else if (process.env.NODE_ENV === 'development') {
          console.log('🟡 [模块_异步] -> cn Key 重复，已物理丢弃:', nk);
        }
      });

      // 🔧 第二轮：额外注册 en 词汇（对英文原文命中，同时兜底爬虫抓取的英文新闻）
      // explanation 始终使用当前语言对应的解释，保证显示内容正确
      enFluffs.forEach((item, idx) => {
        const targetItem = targetFluffs[idx] || item;
        const parsed = parseFluffItem(item, targetItem);
        if (!parsed) return;
        const nk = parsed.key.normalize('NFC');
        if (!dict[nk]) {
          dict[nk] = parsed.explanation;
          if (process.env.NODE_ENV === 'development') {
            console.log('🟢 [模块_发起] -> 加载 en 词汇:', nk);
          }
        } else if (process.env.NODE_ENV === 'development') {
          console.log('🟡 [模块_异步] -> en Key 重复，已物理丢弃:', nk);
        }
      });

      // EN 模式：脚注解释不得含中文；无论是否登录都发起翻译，翻译仍失败则静默移除词条（不显示占位符）
      const polishEnFootnotes: { key: string; tailCn: string }[] = [];
      if (lang === 'en') {
        const seenPolish = new Set<string>();
        for (const key of Object.keys(dict)) {
          const explanation = dict[key];
          if (!explanation || !hasChinese(explanation)) continue;
          if (!seenPolish.has(key)) {
            seenPolish.add(key);
            polishEnFootnotes.push({ key, tailCn: explanation });
          }
        }
        if (
          process.env.NODE_ENV === 'development' &&
          polishEnFootnotes.length > 0
        ) {
          console.log(
            '🟡 [模块_异步] -> EN 脚注含中文，待译条数:',
            polishEnFootnotes.length
          );
        }
      }

      // EN 模式：将含中文值的词条从 dict 预先移除，等待翻译异步回填
      // 旧策略：直接 delete 会导致 key 命中失效 → 红泡高亮延迟出现，体感像“页面加载很慢”
      // 新策略：保留 key，先用英文占位符保证高亮与可点击；翻译完成后再回填真实英文解释。
      if (lang === 'en') {
        for (const { key } of polishEnFootnotes) {
          dict[key] = 'Language protocol compiling…';
        }
      }

      setDictionary(dict);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(dictCacheKey(id, lang), JSON.stringify(dict));
        } catch {
          /* ignore */
        }
      }

      if (lang === 'en' && polishEnFootnotes.length > 0) {
        const sourceTail = polishEnFootnotes
          .map((item) => `${item.key}::${item.tailCn}`)
          .join('\n');
        void resolveFluffCache({
          sourceLang: 'cn',
          targetLang: 'en',
          sourceContent: sourceTail,
          produce: async () => JSON.stringify(await translateFluffTailsToEnglish(polishEnFootnotes)),
        }).then((mappedRaw) => {
          let mapped: Record<string, string> = {};
          try {
            mapped = JSON.parse(mappedRaw) as Record<string, string>;
          } catch {
            mapped = {};
          }
          setDictionary((prev) => {
            const next: Record<string, string> = { ...prev, ...mapped };
            // 翻译后仍含中文则静默移除该词条，避免显示简略占位符
            for (const k of Object.keys(next)) {
              if (hasChinese(next[k])) {
                delete next[k];
              }
            }
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem(dictCacheKey(id, lang), JSON.stringify(next));
              } catch {
                /* ignore */
              }
            }
            return next;
          });
        });
      }
    }
  }, [signal, lang, hasSession, resolveFluffCache]);

  const handleDossierClick = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setAuthContext({ title: "DOSSIER LOCKED", subtitle: lang === 'cn' ? "登录以解锁流式破译协议。" : "Sign in to unlock the streaming decryption protocol." });
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
    const confirm = window.confirm(lang === 'cn' ? "⚠️ [PURGE PROTOCOL] 物理抹杀此资产？" : "⚠️ [PURGE PROTOCOL] Permanently destroy this asset?");
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
        alert(lang === 'cn' ? `抹杀失败: ${json.error}` : `Purge failed: ${json.error}`);
      }
    } catch { 
      alert(lang === 'cn' ? "网络阻断" : "Network error.");
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
      {/* 全屏不透明翻译遮罩：翻译期间完全覆盖页面，无任何模糊透视 */}
      <AnimatePresence>
        {isDossierTranslating ? (
          <motion.div
            key="translate-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] bg-[var(--td-surface-0)] flex flex-col items-center justify-center gap-6"
          >
            <Loader2 className="w-12 h-12 text-red-600 animate-spin" />
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm font-mono uppercase tracking-widest text-zinc-500">
                {lang === 'cn' ? '正在翻译语言协议…' : 'Translating language protocol…'}
              </p>
              <p className="text-xs font-mono text-zinc-400">
                {lang === 'cn' ? '全文分段处理，请稍候' : 'Processing in sections, please wait'}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {pngBlocks ? (
        <IntelExportHtmlMount ref={pngMountRef} blocks={pngBlocks} />
      ) : null}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} title={authContext.title} subtitle={authContext.subtitle} lang={lang} />
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
                    <button onClick={() => setLang('cn')} disabled={isDossierTranslating} className={`px-4 py-1.5 text-[10px] font-bold transition-all rounded disabled:opacity-50 disabled:cursor-not-allowed ${lang === 'cn' ? 'bg-red-100 text-red-700' : 'text-zinc-500 hover:text-zinc-800'}`}>CN</button>
              <button onClick={() => setLang('en')} disabled={isDossierTranslating} className={`px-4 py-1.5 text-[10px] font-bold transition-all rounded disabled:opacity-50 disabled:cursor-not-allowed ${lang === 'en' ? 'bg-red-100 text-red-700' : 'text-zinc-500 hover:text-zinc-800'}`}>EN</button>
            </div>
            {isDossierTranslating ? (
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                {lang === 'cn' ? '语言协议重组中...' : 'Language protocol compiling...'}
              </span>
            ) : null}
            {canPurgeSignals ? (
              <button onClick={handlePurge} disabled={isDeleting} className="group flex items-center justify-center w-9 h-9 bg-white border border-zinc-200 hover:border-red-300 hover:bg-red-50 transition-all rounded-md disabled:opacity-50 shadow-sm" title="Purge"><Trash2 size={16} className="text-zinc-500 group-hover:text-red-600" /></button>
            ) : null}
          </div>
        </header>

        <section className="mb-10"><VerdictPanel verdict={(signal.metadata?.bilingual?.[lang] || signal.verdict) as string} isErased={true} lang={lang} /></section>

        <IntelProfilePanel
          profile={signal.metadata?.intelProfile}
          profileError={signal.metadata?.intelProfileError as IntelProfileError | undefined}
          lang={lang}
          signalId={id}
          enrichmentPending={Boolean(
            signal.metadata &&
              typeof signal.metadata === 'object' &&
              (signal.metadata as { enrichmentPending?: boolean }).enrichmentPending === true &&
              !signal.metadata?.intelProfile
          )}
          onRetryProfile={handleRetryProfile}
          retryProfileDisabled={isRetryingProfile || profileRetryCooldownSec > 0}
          retryingProfile={isRetryingProfile}
          retryCooldownSec={profileRetryCooldownSec}
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
                isTranslating={isDossierTranslating}
                isTruncated={isTruncated} 
                qualityError={streamQualityError}
                recoveryHint={dossierRecoveryStatus}
                lang={lang}
              /> 
            )}
          </div>
        </div>

        <div className="mt-12 border-t border-[var(--td-border)] pt-12 flex flex-col gap-3">
          <TerminalQuotaStrip
            quota={terminalQuota}
            lang={lang}
            hasSession={hasSession}
            className="shrink-0"
          />
          <ChatTerminal
            signalId={id}
            hardFacts={currentHardFacts}
            lang={lang}
            onRequireAuth={() => {
              setAuthContext({
                title: 'QUOTA EXCEEDED',
                subtitle: lang === 'cn' ? '登录以解除频率限制。' : 'Sign in to remove rate limits.',
              });
              setIsAuthModalOpen(true);
            }}
            onQuotaExceeded={() => {
              void (async () => {
                const {
                  data: { session },
                } = await supabase.auth.getSession();
                await fetchEntitlementsForSession(session);
                setAuthContext({
                  title: lang === 'cn' ? '审讯次数已用尽' : 'TERMINAL QUOTA EXCEEDED',
                  subtitle:
                    lang === 'cn'
                      ? '本月深度审讯次数已用完。订阅 Pro 可无限追问，或于下月（UTC）重置后再试。'
                      : 'Monthly terminal quota reached. Subscribe to Pro for unlimited interrogations, or try again next month (UTC).',
                });
                setIsAuthModalOpen(true);
              })();
            }}
            onMessagesChange={setTerminalMessages}
          />
        </div>
      </div>
    </main>
  );
}