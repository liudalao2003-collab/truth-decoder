/**
 * 入库前双语对齐：以中文 intel 为事实源，将 verdict / facts / fluff 的英文补全为译文，
 * 避免流式截断抢救只回填 CN 导致 EN 占位句与 CN 割裂。
 */

import { z } from 'zod';
import type { IntelProfile } from '@/types/intel-profile';
import { IntelProfileSchema } from '@/types/intel-profile';
import { logger } from '@/utils/logger';

/** 与 ingest / 首页提交契约一致的双语 intel 形状 */
export interface IngestIntelVerdict {
  cn: string;
  en: string;
}

export interface IngestIntelBilingual {
  verdict?: IngestIntelVerdict;
  facts?: { cn: string[]; en: string[] };
  fluff?: { cn: string[]; en: string[] };
}

/** 将客户端任意 intel 形态收敛为强类型，便于入库前修复 */
export function normalizeIngestIntel(raw: unknown): IngestIntelBilingual {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const verdictRaw = o.verdict;
  let verdict: IngestIntelVerdict | undefined;
  if (verdictRaw && typeof verdictRaw === 'object' && !Array.isArray(verdictRaw)) {
    const vr = verdictRaw as Record<string, unknown>;
    verdict = {
      cn: typeof vr.cn === 'string' ? vr.cn : '',
      en: typeof vr.en === 'string' ? vr.en : '',
    };
  } else if (typeof verdictRaw === 'string') {
    verdict = { cn: verdictRaw, en: '' };
  }

  const factsRaw = o.facts;
  let facts: { cn: string[]; en: string[] } | undefined;
  if (factsRaw && typeof factsRaw === 'object' && !Array.isArray(factsRaw)) {
    const fr = factsRaw as Record<string, unknown>;
    facts = {
      cn: Array.isArray(fr.cn)
        ? fr.cn.filter((x): x is string => typeof x === 'string')
        : [],
      en: Array.isArray(fr.en)
        ? fr.en.filter((x): x is string => typeof x === 'string')
        : [],
    };
  }

  const fluffRaw = o.fluff;
  let fluff: { cn: string[]; en: string[] } | undefined;
  if (fluffRaw && typeof fluffRaw === 'object' && !Array.isArray(fluffRaw)) {
    const fr = fluffRaw as Record<string, unknown>;
    fluff = {
      cn: Array.isArray(fr.cn)
        ? fr.cn.filter((x): x is string => typeof x === 'string')
        : [],
      en: Array.isArray(fr.en)
        ? fr.en.filter((x): x is string => typeof x === 'string')
        : [],
    };
  }

  return { verdict, facts, fluff };
}

const PLACEHOLDER_EN_SUBSTRINGS = [
  'stream truncated',
  'rescue protocol',
  'data stream',
  '物理层抢救',
] as const;

function normalizeVerdict(
  v: unknown
): { cn: string; en: string } | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    return {
      cn: typeof o.cn === 'string' ? o.cn : '',
      en: typeof o.en === 'string' ? o.en : '',
    };
  }
  if (typeof v === 'string') {
    return { cn: v, en: '' };
  }
  return null;
}

function isPlaceholderEnglishVerdict(en: string): boolean {
  const t = en.trim().toLowerCase();
  if (t.length < 6) return true;
  return PLACEHOLDER_EN_SUBSTRINGS.some((s) => t.includes(s));
}

/** 判断是否需要调用模型补齐英文（避免健康双语重复花钱） */
export function needsEnglishRepair(intel: IngestIntelBilingual): boolean {
  const verdict = normalizeVerdict(intel.verdict);
  const cnV = verdict?.cn?.trim() ?? '';
  const enV = verdict?.en?.trim() ?? '';
  if (cnV.length >= 12 && (isPlaceholderEnglishVerdict(enV) || enV.length === 0)) {
    return true;
  }

  const factsCn = intel.facts?.cn ?? [];
  const factsEn = intel.facts?.en ?? [];
  if (factsCn.length > 0) {
    if (factsEn.length < factsCn.length) return true;
    for (let i = 0; i < factsCn.length; i++) {
      const c = factsCn[i]?.trim() ?? '';
      const e = factsEn[i]?.trim() ?? '';
      if (c.length > 8 && e.length < 4) return true;
    }
  }

  const fluffCn = intel.fluff?.cn ?? [];
  const fluffEn = intel.fluff?.en ?? [];
  if (fluffCn.length > 0) {
    if (fluffEn.length < fluffCn.length) return true;
    for (let i = 0; i < fluffCn.length; i++) {
      const c = fluffCn[i]?.trim() ?? '';
      const e = fluffEn[i]?.trim() ?? '';
      if (c.length > 10 && e.length < 6) return true;
    }
  }

  return false;
}

const RepairIntelOutputSchema = z.object({
  verdict: z.object({
    en: z.string(),
  }),
  facts: z.object({
    en: z.array(z.string()),
  }),
  fluff: z.object({
    en: z.array(z.string()),
  }),
});

function stripJsonFence(raw: string): string {
  let s = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a !== -1 && b !== -1 && b >= a) s = s.slice(a, b + 1);
  return s;
}

async function callDeepSeekJsonObject(
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('未配置 DEEPSEEK_API_KEY');

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.2,
      max_tokens: 8192,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`DeepSeek HTTP ${res.status}: ${t}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const raw = data.choices?.[0]?.message?.content;
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  throw new Error('DeepSeek 返回空正文');
}

const REPAIR_SYSTEM = `You are a professional financial/political intelligence translator for TruthDecoder.
TASK: Output ONE JSON object only. Translate Chinese source fields into English. Do NOT rewrite or summarize the Chinese meaning differently — preserve analytical depth; English must be the faithful counterpart.

RULES:
1) verdict.en: fluent English translation of verdict.cn.
2) facts.en: same length as facts.cn; facts.en[i] translates facts.cn[i].
3) fluff.en: same length as fluff.cn. For each line, the substring BEFORE the first "::" or "::" (fullwidth colon pair) MUST be BYTE-FOR-BYTE identical to the Chinese line's anchor before the same separator. Only translate the part AFTER the separator into English. If the Chinese line uses "词汇::解析", output "词汇::English analysis..." with the same leading anchor text as in cn.
4) No markdown fences. No commentary outside JSON.

OUTPUT SHAPE:
{"verdict":{"en":"..."},"facts":{"en":["..."]},"fluff":{"en":["..."]}}`;

/**
 * 以中文为准补齐英文 intel；失败时返回原 intel，不阻断入库。
 */
export async function repairIntelEnglishFromChinese(
  intel: IngestIntelBilingual
): Promise<IngestIntelBilingual> {
  if (!needsEnglishRepair(intel)) return intel;

  const verdict = normalizeVerdict(intel.verdict);
  const factsCn = intel.facts?.cn ?? [];
  const factsEn = intel.facts?.en ?? [];
  const fluffCn = intel.fluff?.cn ?? [];
  const fluffEn = intel.fluff?.en ?? [];

  const payload = {
    verdict_cn: verdict?.cn ?? '',
    facts_cn: factsCn,
    fluff_cn: fluffCn,
    facts_en_existing: factsEn,
    fluff_en_existing: fluffEn,
  };

  try {
    const raw = await callDeepSeekJsonObject(
      REPAIR_SYSTEM,
      `Translate into English per rules. INPUT JSON:\n${JSON.stringify(payload)}`
    );
    const cleaned = stripJsonFence(raw).replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    const parsed: unknown = JSON.parse(cleaned);
    const out = RepairIntelOutputSchema.safeParse(parsed);
    if (!out.success) {
      return intel;
    }

    const v0 = normalizeVerdict(intel.verdict) ?? { cn: '', en: '' };
    const mergedVerdict: IngestIntelVerdict = {
      cn: v0.cn,
      en: out.data.verdict.en.trim() || v0.en,
    };

    const mergedFacts = {
      cn: factsCn,
      en: padOrTrimArray(out.data.facts.en, factsCn.length, factsEn),
    };

    const mergedFluffEn = alignFluffEnglish(fluffCn, out.data.fluff.en, fluffEn);

    return {
      ...intel,
      verdict: mergedVerdict,
      facts: mergedFacts,
      fluff: { cn: fluffCn, en: mergedFluffEn },
    };
  } catch (e) {
    logger.crash(e);
    return intel;
  }
}

function padOrTrimArray(
  next: string[],
  targetLen: number,
  fallback: string[]
): string[] {
  const r: string[] = [];
  for (let i = 0; i < targetLen; i++) {
    const v = next[i]?.trim();
    if (v) r.push(v);
    else r.push(fallback[i]?.trim() ?? '');
  }
  return r;
}

/**
 * 校验并修正 fluff.en：强制与 cn 行在 :: 左侧锚点一致。
 */
function alignFluffEnglish(
  fluffCn: string[],
  modelEn: string[],
  fallbackEn: string[]
): string[] {
  return fluffCn.map((cnLine, i) => {
    const cnParts = cnLine.split(/(?:::|：：)/);
    const anchor = cnParts[0] ?? '';
    const tailCn = cnParts.slice(1).join('::');

    const candidate = modelEn[i]?.trim() || fallbackEn[i]?.trim() || '';
    const enParts = candidate.split(/(?:::|：：)/);
    const enAnchor = (enParts[0] ?? '').trim();
    if (anchor.trim() && enAnchor === anchor.trim()) {
      return candidate;
    }
    if (anchor.trim() && enAnchor.length > 0 && anchor.includes(enAnchor)) {
      return candidate;
    }
    const tailEn =
      enParts.length >= 2
        ? enParts.slice(1).join('::').trim()
        : candidate;
    if (anchor.trim()) {
      return `${anchor}::${tailEn || tailCn}`;
    }
    return candidate || cnLine;
  });
}

// --- 情报体征：英文空缺时从中文译补 ---

function countChineseChars(s: string): number {
  return (s.match(/[\u4e00-\u9fff]/g) ?? []).length;
}

/** 若任意 en 明显弱于对应 cn，则需要译补 */
export function needsIntelProfileEnglishRepair(profile: IntelProfile): boolean {
  const { rationale, stakeholders, verificationChecklist } = profile;

  for (const key of [
    'narrativeIncitement',
    'stakeholderEntanglement',
    'verifiability',
    'actionUrging',
  ] as const) {
    const block = rationale[key];
    const cn = block.cn;
    const en = block.en;
    const n = Math.min(cn.length, en.length);
    for (let i = 0; i < n; i++) {
      if (shouldRepairPair(cn[i] ?? '', en[i] ?? '')) return true;
    }
  }

  for (const row of stakeholders) {
    for (const field of ['subject', 'role', 'impact', 'anchor'] as const) {
      const b = row[field];
      if (shouldRepairPair(b.cn, b.en)) return true;
    }
  }

  for (const v of verificationChecklist) {
    if (shouldRepairPair(v.item.cn, v.item.en)) return true;
  }

  return false;
}

function shouldRepairPair(cn: string, en: string): boolean {
  const c = cn.trim();
  const e = en.trim();
  if (c.length < 8) return false;
  if (e.length === 0) return true;
  if (countChineseChars(e) >= 2) return true;
  return false;
}

const ProfileEnRepairSchema = IntelProfileSchema;

/**
 * 将体征 JSON 中偏弱的 en 按对应 cn 译为英文，结构不变。
 */
export async function repairIntelProfileEnglishFromChinese(
  profile: IntelProfile
): Promise<IntelProfile> {
  if (!needsIntelProfileEnglishRepair(profile)) return profile;

  const SYSTEM = `You are a professional translator for intelligence reports.
You receive ONE JSON object (TruthDecoder IntelProfile). Keep every "cn" string unchanged.
For every "en" string: if the matching Chinese meaning exists in the parallel "cn" field in the same object/array index, translate that meaning into fluent English. If en is already strong English with no Chinese characters, keep it.
Output ONE JSON object only, identical schema, valid UTF-8. No markdown.`;

  try {
    const raw = await callDeepSeekJsonObject(
      SYSTEM,
      `Repair English fields from Chinese. INPUT:\n${JSON.stringify(profile)}`
    );
    const cleaned = stripJsonFence(raw).replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    const parsed: unknown = JSON.parse(cleaned);
    const result = ProfileEnRepairSchema.safeParse(parsed);
    if (result.success) return result.data;
    return profile;
  } catch (e) {
    logger.crash(e);
    return profile;
  }
}
