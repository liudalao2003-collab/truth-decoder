/**
 * 情报体征短调用：单独结构化输出，避免与 wash/ingest 主 JSON 契约耦合。
 */

import { BilingualData } from '@/types/database';
import {
  INTEL_PROFILE_SCHEMA_VERSION,
  IntelProfile,
  IntelProfileRadarKeys,
  IntelProfileSchema,
} from '@/types/intel-profile';
import { logger } from '@/utils/logger';

export const INTEL_PROFILE_PROMPT_VERSION = 'intel-profile-v2';

/** 精简信源长度，降低触发上游 content_filter 的概率 */
const INTEL_SOURCE_SLIM_CHARS = 4000;

function normalizeHardFacts(facts: BilingualData | string[] | undefined): {
  cn: string[];
  en: string[];
} {
  if (!facts) return { cn: [], en: [] };
  if (Array.isArray(facts)) {
    return { cn: facts, en: facts };
  }
  return {
    cn: facts.cn ?? [],
    en: facts.en ?? [],
  };
}

function stripJsonFence(raw: string): string {
  let s = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a !== -1 && b !== -1 && b >= a) s = s.slice(a, b + 1);
  return s;
}

/** 从 chat/completions 响应中取出正文（兼容 content 为字符串或空的情况） */
function extractAssistantText(data: {
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string | null };
  }>;
}): string {
  const raw = data.choices?.[0]?.message?.content;
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }
  return '';
}

type IntelFetchStrategy = {
  useJsonObjectFormat: boolean;
  temperature: number;
  maxTokens: number;
};

const INTEL_FETCH_STRATEGIES: IntelFetchStrategy[] = [
  { useJsonObjectFormat: true, temperature: 0.25, maxTokens: 8192 },
  { useJsonObjectFormat: true, temperature: 0.35, maxTokens: 8192 },
  /** 部分环境下 json_object 会偶发空正文，降级为普通补全仍要求 JSON */
  { useJsonObjectFormat: false, temperature: 0.35, maxTokens: 8192 },
];

/**
 * 情报体征专用：多策略重试，避免 DeepSeek 在 json_object 下返回空 message.content。
 */
async function callDeepSeekJson(
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('未配置 DEEPSEEK_API_KEY');

  let lastEmptyDiag: string | undefined;

  for (let i = 0; i < INTEL_FETCH_STRATEGIES.length; i++) {
    const strat = INTEL_FETCH_STRATEGIES[i];
    if (i > 0) {
      await new Promise((r) => setTimeout(r, 400 * i));
    }

    const body: Record<string, unknown> = {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: strat.useJsonObjectFormat
            ? userContent
            : `${userContent}\n\n【输出要求】仅输出一个合法 JSON 对象，不要 Markdown 围栏。`,
        },
      ],
      temperature: strat.temperature,
      max_tokens: strat.maxTokens,
    };
    if (strat.useJsonObjectFormat) {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`DeepSeek HTTP ${res.status}: ${t}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{
        finish_reason?: string;
        message?: { content?: string | null };
      }>;
    };
    const text = extractAssistantText(data);
    if (text.length > 0) {
      return text;
    }

    const fr = data.choices?.[0]?.finish_reason;
    lastEmptyDiag = `finish_reason=${String(fr)},jsonMode=${strat.useJsonObjectFormat}`;
    // content_filter 时同一段输入再试 json/text 档位通常仍为空；立即进入下一链路以缩短等待
    if (fr === 'content_filter') {
      throw new Error(
        lastEmptyDiag
          ? `DeepSeek 返回空内容（${lastEmptyDiag}）`
          : 'DeepSeek 返回空内容'
      );
    }
  }

  throw new Error(
    lastEmptyDiag
      ? `DeepSeek 返回空内容（${lastEmptyDiag}）`
      : 'DeepSeek 返回空内容'
  );
}

const SYSTEM_PROMPT = `[SYSTEM: TruthDecoder Intel Signature Engine ${INTEL_PROFILE_PROMPT_VERSION}]
You output ONE JSON object only. No markdown outside JSON.

LANGUAGE LAW:
- Every "cn" string: Simplified Chinese only. No English letters in cn fields.
- Every "en" string: English only. No Chinese characters in en fields.

TONE LAW (anti-generic):
- Write like a hostile forensic analyst, not a journalist summary. No filler, no "balanced overview", no "needs further observation", no "overall", no "on the one hand".
- Every sentence must carry a mechanism, a transfer of value, or a falsifiable gap. If you cannot say something sharp, say less.

SCORING LAW (0-100 integers):
- narrativeIncitement: emotional leverage, fear/greed hooks, loaded language in the source.
- stakeholderEntanglement: distinct power/interest centers in structural tension (not headcount).
- verifiability: how checkable claims are (primary data, filings, traceable facts) — NOT a "truth" verdict.
- actionUrging: push to trade, boycott, panic, or take sides.
- COHERENCE: If a radar score is high (e.g. >= 70), the matching rationale bullets MUST show equally sharp mechanisms; avoid high scores with vague bullets.

RATIONALE LAW (per dimension, per language):
- Provide 1 to 3 bullets in each of "cn" and "en" arrays (same count in cn and en for each dimension).
- Order: first bullet = THE PUNCH LINE (shortest, most incisive attack on the narrative).
- Following bullets = evidence chain (finer, still anchored).
- Each bullet MUST anchor by EITHER a short verbatim phrase from the source OR a fact index "事实N" / "Fact N" where N matches the indexed HARD_FACTS lists (1-based).
- Each bullet must combine: (1) mechanism — how the narrative pressures the reader or hides a transfer; (2) consequence — who pays, who extracts, or what becomes unverifiable.
- Do not output legal verdicts or "guilty" language; stay forensic.

STAKEHOLDERS LAW (1-12 rows):
- subject: concrete actor or institution.
- role: structural identity (regulator, counterparty, narrative beneficiary, etc.), not a title-only resume line.
- impact: MUST state direction of transfer of power, cashflow, or reputation (who gains more, who loses more, who is blurred). Ban vague "has impact".
- anchor: MUST tie back to a verbatim phrase from the source OR a fact index "事实N" / "Fact N". No generic labels.

VERIFICATION LAW (3-5 items):
- Each item MUST be actionable: what to check, where (primary source), and what number/date/timestamp to match.
- Prefer primary sources: exchange filings, regulator disclosures, original documents — not secondary commentary.
- Each item MUST embed the falsification consequence in the same sentence: if this check fails, which narrative claim collapses or weakens.
- Bilingual: item.cn and item.en must carry the same meaning.

AUDIT:
- Set audit.model to "deepseek-chat"
- Set audit.generatedAt to ISO-8601 UTC now
- Set audit.promptVersion to "${INTEL_PROFILE_PROMPT_VERSION}"

REQUIRED TOP-LEVEL SHAPE:
{
  "schemaVersion": ${INTEL_PROFILE_SCHEMA_VERSION},
  "radar": { "narrativeIncitement": 0, "stakeholderEntanglement": 0, "verifiability": 0, "actionUrging": 0 },
  "rationale": {
    "narrativeIncitement": { "cn": ["...", "..."], "en": ["...", "..."] },
    "stakeholderEntanglement": { "cn": ["..."], "en": ["..."] },
    "verifiability": { "cn": ["..."], "en": ["..."] },
    "actionUrging": { "cn": ["..."], "en": ["..."] }
  },
  "stakeholders": [
    { "subject": { "cn": "...", "en": "..." }, "role": { "cn": "...", "en": "..." }, "impact": { "cn": "...", "en": "..." }, "anchor": { "cn": "...", "en": "..." } }
  ],
  "verificationChecklist": [ { "item": { "cn": "...", "en": "..." } } ],
  "audit": { "model": "deepseek-chat", "generatedAt": "...", "promptVersion": "${INTEL_PROFILE_PROMPT_VERSION}" }
}`;

/** 上游 content_filter 空响应时降级：中性表述，契约与主提示一致，降低触发过滤概率 */
const SYSTEM_PROMPT_NEUTRAL = `[SYSTEM: TruthDecoder Intel Signature Engine ${INTEL_PROFILE_PROMPT_VERSION}-neutral]
You output ONE JSON object only. No markdown outside JSON.

LANGUAGE LAW:
- Every "cn" string: Simplified Chinese only. No English letters in cn fields.
- Every "en" string: English only. No Chinese characters in en fields.

TONE LAW (neutral):
- Use neutral, descriptive, analytical language. No hostile or inflammatory framing.
- Focus on mechanisms, incentives, and verifiability without legal verdicts or investment advice.
- Each sentence should still carry substance; avoid hollow filler.

SCORING LAW (0-100 integers):
- narrativeIncitement: emotional leverage, fear/greed hooks, loaded language in the source.
- stakeholderEntanglement: distinct power/interest centers in structural tension (not headcount).
- verifiability: how checkable claims are (primary data, filings, traceable facts) — NOT a "truth" verdict.
- actionUrging: push to trade, boycott, panic, or take sides.
- COHERENCE: If a radar score is high (e.g. >= 70), the matching rationale bullets MUST show equally concrete mechanisms.

RATIONALE LAW (per dimension, per language):
- Provide 1 to 3 bullets in each of "cn" and "en" arrays (same count in cn and en for each dimension).
- Order: first bullet = sharpest summary line; following bullets = evidence chain.
- Each bullet MUST anchor by EITHER a short verbatim phrase from the source OR a fact index "事实N" / "Fact N" where N matches the indexed HARD_FACTS lists (1-based).
- Each bullet: (1) mechanism — how the narrative frames the reader; (2) consequence — what becomes hard to verify or who bears cost.

STAKEHOLDERS LAW (1-12 rows):
- subject: concrete actor or institution.
- role: structural identity (regulator, counterparty, narrative beneficiary, etc.).
- impact: direction of transfer of power, cashflow, or reputation (who gains more, who loses more).
- anchor: verbatim phrase from the source OR fact index "事实N" / "Fact N".

VERIFICATION LAW (3-5 items):
- Each item MUST be actionable: what to check, where (primary source), and what number/date/timestamp to match.
- Prefer primary sources: exchange filings, regulator disclosures, original documents.
- Each item MUST embed the falsification consequence in the same sentence.
- Bilingual: item.cn and item.en must carry the same meaning.

AUDIT:
- Set audit.model to "deepseek-chat"
- Set audit.generatedAt to ISO-8601 UTC now
- Set audit.promptVersion to "${INTEL_PROFILE_PROMPT_VERSION}-neutral"

REQUIRED TOP-LEVEL SHAPE:
{
  "schemaVersion": ${INTEL_PROFILE_SCHEMA_VERSION},
  "radar": { "narrativeIncitement": 0, "stakeholderEntanglement": 0, "verifiability": 0, "actionUrging": 0 },
  "rationale": {
    "narrativeIncitement": { "cn": ["...", "..."], "en": ["...", "..."] },
    "stakeholderEntanglement": { "cn": ["..."], "en": ["..."] },
    "verifiability": { "cn": ["..."], "en": ["..."] },
    "actionUrging": { "cn": ["..."], "en": ["..."] }
  },
  "stakeholders": [
    { "subject": { "cn": "...", "en": "..." }, "role": { "cn": "...", "en": "..." }, "impact": { "cn": "...", "en": "..." }, "anchor": { "cn": "...", "en": "..." } }
  ],
  "verificationChecklist": [ { "item": { "cn": "...", "en": "..." } } ],
  "audit": { "model": "deepseek-chat", "generatedAt": "...", "promptVersion": "${INTEL_PROFILE_PROMPT_VERSION}-neutral" }
}`;

/** 仅事实块：不附带原文，用于极端 content_filter 时的最后一跳 */
const SYSTEM_PROMPT_FACTS_ONLY = `[SYSTEM: TruthDecoder Intel Signature Engine ${INTEL_PROFILE_PROMPT_VERSION}-facts-only]
You output ONE JSON object only. No markdown outside JSON.
The user message contains ONLY indexed hard facts, no full article. Infer a conservative intel profile from those facts alone. Use neutral institutional language.

LANGUAGE LAW:
- "cn" strings: Simplified Chinese only. "en" strings: English only.

Fill every required field in the same JSON shape as prior TruthDecoder intel profiles. Use moderate radar scores (40-60) unless facts clearly justify otherwise.

REQUIRED TOP-LEVEL SHAPE:
{
  "schemaVersion": ${INTEL_PROFILE_SCHEMA_VERSION},
  "radar": { "narrativeIncitement": 0, "stakeholderEntanglement": 0, "verifiability": 0, "actionUrging": 0 },
  "rationale": {
    "narrativeIncitement": { "cn": ["..."], "en": ["..."] },
    "stakeholderEntanglement": { "cn": ["..."], "en": ["..."] },
    "verifiability": { "cn": ["..."], "en": ["..."] },
    "actionUrging": { "cn": ["..."], "en": ["..."] }
  },
  "stakeholders": [ { "subject": { "cn": "...", "en": "..." }, "role": { "cn": "...", "en": "..." }, "impact": { "cn": "...", "en": "..." }, "anchor": { "cn": "...", "en": "..." } } ],
  "verificationChecklist": [ { "item": { "cn": "...", "en": "..." } } ],
  "audit": { "model": "deepseek-chat", "generatedAt": "...", "promptVersion": "${INTEL_PROFILE_PROMPT_VERSION}-facts-only" }
}`;

function buildUserBlock(
  rawContent: string,
  cn: string[],
  en: string[],
  mode: 'full' | 'slim' | 'factsOnly'
): string {
  const excerpt =
    mode === 'full'
      ? rawContent.slice(0, 120_000)
      : mode === 'slim'
        ? `${rawContent.slice(0, INTEL_SOURCE_SLIM_CHARS)}\n\n[… 原文已截断，仅保留前 ${INTEL_SOURCE_SLIM_CHARS} 字以降低过滤风险 …]`
        : '';

  if (mode === 'factsOnly') {
    return [
      '【MODE】facts_only_no_article_body',
      '【HARD_FACTS_CN_INDEXED】',
      cn.map((t, i) => `${i + 1}. ${t}`).join('\n') || '(none)',
      '',
      '【HARD_FACTS_EN_INDEXED】',
      en.map((t, i) => `${i + 1}. ${t}`).join('\n') || '(none)',
      '',
      '【OUTPUT_DISCIPLINE】',
      '仅依据上述事实生成体征；rationale 每条须引用「事实N」或「Fact N」。',
    ].join('\n');
  }

  return [
    '【SOURCE_TEXT】',
    excerpt,
    '',
    '【HARD_FACTS_CN_INDEXED】',
    cn.map((t, i) => `${i + 1}. ${t}`).join('\n') || '(none)',
    '',
    '【HARD_FACTS_EN_INDEXED】',
    en.map((t, i) => `${i + 1}. ${t}`).join('\n') || '(none)',
    '',
    '【OUTPUT_DISCIPLINE】',
    '每条 rationale 须与 HARD_FACTS 对齐：优先引用「事实N」或「Fact N」；否则引用原文短语。',
    '每维依据：第1条为最短总刺，后续为证据链；禁止空话、平衡式综述与「需进一步观察」等套话。',
    'stakeholders.impact 须写清权力/现金流/声誉的转移方向；anchor 须扣回原文措辞或事实编号。',
    'verificationChecklist 每条须含可执行动作（查什么、去哪、对什么数字或时间），并说明若证伪则何种叙事不成立；优先一级来源。',
    'radar 分数须与 rationale 锐利度自洽。',
    '',
    'Each rationale bullet must anchor to indexed facts or verbatim source text. First bullet per dimension = punch line; follow-ups = evidence chain.',
    'Stakeholder impact must state transfer direction; anchor must cite verbatim phrase or fact index.',
    'Verification items must be actionable with primary-source preference and falsification consequence.',
  ].join('\n');
}

/**
 * 按顺序尝试多组 system + 信源块，直到拿到非空 JSON 字符串。
 * 顺序设计：先全文主/中性，再精简信源，再仅事实（避开原文触发的过滤）。
 */
async function fetchIntelProfileJsonString(
  userFull: string,
  userSlim: string,
  userFactsOnly: string
): Promise<string> {
  const chain: Array<[string, string]> = [
    [SYSTEM_PROMPT, userFull],
    [SYSTEM_PROMPT_NEUTRAL, userFull],
    [SYSTEM_PROMPT_NEUTRAL, userSlim],
    [SYSTEM_PROMPT, userSlim],
    [SYSTEM_PROMPT_NEUTRAL, userFactsOnly],
    [SYSTEM_PROMPT_FACTS_ONLY, userFactsOnly],
  ];

  let lastErr: unknown = new Error('unknown');
  for (const [sys, block] of chain) {
    try {
      return await callDeepSeekJson(sys, block);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error('情报体征 LLM 全链路失败');
}

const DEFAULT_BULLET_CN = '模型输出结构不完整或受平台策略限制，已自动补齐；可稍后由管理员触发补算。';
const DEFAULT_BULLET_EN =
  'Output was incomplete or policy-limited; auto-filled. Admin may regenerate.';

/** 修补常见畸形 JSON（如 rationale 某维缺 cn/en 数组），再交给 Zod */
function coerceIntelProfileLoose(input: unknown): unknown {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return input;
  }
  const o = { ...(input as Record<string, unknown>) };

  if (!o.radar || typeof o.radar !== 'object') {
    o.radar = {
      narrativeIncitement: 50,
      stakeholderEntanglement: 50,
      verifiability: 50,
      actionUrging: 50,
    };
  } else {
    const r = o.radar as Record<string, unknown>;
    for (const k of IntelProfileRadarKeys) {
      const v = r[k];
      if (typeof v !== 'number' || Number.isNaN(v)) {
        r[k] = 50;
      }
    }
  }

  const ratBase =
    o.rationale && typeof o.rationale === 'object' && !Array.isArray(o.rationale)
      ? { ...(o.rationale as Record<string, unknown>) }
      : {};
  for (const d of IntelProfileRadarKeys) {
    const block = ratBase[d];
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
      ratBase[d] = { cn: [DEFAULT_BULLET_CN], en: [DEFAULT_BULLET_EN] };
    } else {
      const b = block as Record<string, unknown>;
      if (!Array.isArray(b.cn) || b.cn.length === 0) {
        b.cn = [DEFAULT_BULLET_CN];
      }
      if (!Array.isArray(b.en) || b.en.length === 0) {
        b.en = [DEFAULT_BULLET_EN];
      }
      let cnBullets = (b.cn as string[]).slice(0, 3).filter((x) => typeof x === 'string' && x.trim());
      let enBullets = (b.en as string[]).slice(0, 3).filter((x) => typeof x === 'string' && x.trim());
      if (cnBullets.length === 0) cnBullets = [DEFAULT_BULLET_CN];
      if (enBullets.length === 0) enBullets = [DEFAULT_BULLET_EN];
      while (cnBullets.length < enBullets.length) cnBullets.push(DEFAULT_BULLET_CN);
      while (enBullets.length < cnBullets.length) enBullets.push(DEFAULT_BULLET_EN);
      b.cn = cnBullets;
      b.en = enBullets;
    }
  }
  o.rationale = ratBase;

  if (!Array.isArray(o.stakeholders) || o.stakeholders.length === 0) {
    o.stakeholders = [
      {
        subject: { cn: '待识别主体', en: 'Unspecified actor' },
        role: { cn: '待分析', en: 'Pending analysis' },
        impact: { cn: '待评估', en: 'Pending assessment' },
        anchor: { cn: '事实1', en: 'Fact 1' },
      },
    ];
  }

  if (!Array.isArray(o.verificationChecklist) || o.verificationChecklist.length < 3) {
    o.verificationChecklist = [
      { item: { cn: '核对原文公开出处与发布时间。', en: 'Verify primary source and publication time.' } },
      { item: { cn: '对照监管机构或交易所披露。', en: 'Cross-check regulator or exchange filings.' } },
      { item: { cn: '复核硬事实编号与引用一致性。', en: 'Reconcile fact indices with citations.' } },
    ];
  }

  if (!o.audit || typeof o.audit !== 'object') {
    o.audit = {
      model: 'deepseek-chat',
      generatedAt: new Date().toISOString(),
      promptVersion: `${INTEL_PROFILE_PROMPT_VERSION}-coerced`,
    };
  } else {
    const a = o.audit as Record<string, unknown>;
    if (typeof a.generatedAt !== 'string' || !a.generatedAt) {
      a.generatedAt = new Date().toISOString();
    }
    if (typeof a.promptVersion !== 'string' || !a.promptVersion) {
      a.promptVersion = `${INTEL_PROFILE_PROMPT_VERSION}-coerced`;
    }
    if (typeof a.model !== 'string' || !a.model) {
      a.model = 'deepseek-chat';
    }
  }

  if (o.schemaVersion === undefined) {
    o.schemaVersion = INTEL_PROFILE_SCHEMA_VERSION;
  }

  return o;
}

/** LLM 全失败时的契约内降级，保证入库与页面可用 */
function buildDeterministicFallbackIntelProfile(): IntelProfile {
  const now = new Date().toISOString();
  return {
    schemaVersion: INTEL_PROFILE_SCHEMA_VERSION,
    radar: {
      narrativeIncitement: 50,
      stakeholderEntanglement: 50,
      verifiability: 50,
      actionUrging: 50,
    },
    rationale: {
      narrativeIncitement: {
        cn: ['上游模型未返回可用输出或触发内容策略，已使用占位体征。'],
        en: ['Upstream model returned no usable output or policy blocked; placeholder intel used.'],
      },
      stakeholderEntanglement: {
        cn: ['请在网络稳定或换源后使用管理员补算。'],
        en: ['Retry admin backfill when network is stable or with another source.'],
      },
      verifiability: {
        cn: ['硬事实仍可单独用于核验。'],
        en: ['Hard facts remain usable for verification.'],
      },
      actionUrging: {
        cn: ['此处不给出行动呼吁类结论。'],
        en: ['No action-urging conclusion here.'],
      },
    },
    stakeholders: [
      {
        subject: { cn: '待识别主体', en: 'Unspecified actor' },
        role: { cn: '系统占位', en: 'System placeholder' },
        impact: { cn: '待评估', en: 'Pending' },
        anchor: { cn: '硬事实索引', en: 'Fact index' },
      },
    ],
    verificationChecklist: [
      { item: { cn: '核对原文公开出处。', en: 'Verify primary public sources.' } },
      { item: { cn: '对照官方或监管披露。', en: 'Cross-check official or regulatory disclosures.' } },
      { item: { cn: '确认本页硬事实与原文一致。', en: 'Confirm hard facts match the source text.' } },
    ],
    audit: {
      model: 'deepseek-chat',
      generatedAt: now,
      promptVersion: 'intel-profile-deterministic-fallback-v1',
    },
  };
}

function parseIntelProfileFromRaw(raw: string): IntelProfile | null {
  const cleaned = stripJsonFence(raw).replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }

  const first = IntelProfileSchema.safeParse(parsed);
  if (first.success) return first.data;

  const coerced = coerceIntelProfileLoose(parsed);
  const second = IntelProfileSchema.safeParse(coerced);
  if (second.success) return second.data;
  return null;
}

/**
 * 基于原文与已抽取硬事实生成情报体征；极端失败时返回契约内降级对象，不再抛错阻断入库。
 */
export async function generateIntelProfile(
  rawContent: string,
  hardFacts: BilingualData | string[] | undefined
): Promise<IntelProfile> {
  logger.start('情报体征短调用');
  const { cn, en } = normalizeHardFacts(hardFacts);

  const userFull = buildUserBlock(rawContent, cn, en, 'full');
  const userSlim = buildUserBlock(rawContent, cn, en, 'slim');
  const userFactsOnly = buildUserBlock(rawContent, cn, en, 'factsOnly');

  try {
    logger.async('情报体征 LLM 链式调用（全文→精简→仅事实）');
    const raw = await fetchIntelProfileJsonString(userFull, userSlim, userFactsOnly);
    const profile = parseIntelProfileFromRaw(raw);
    if (profile) {
      logger.success('情报体征契约校验通过');
      return profile;
    }
  } catch (e) {
    logger.crash(e);
  }

  return buildDeterministicFallbackIntelProfile();
}
