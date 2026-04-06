/**
 * 当首页 ingest SSE 截断导致客户端 fluff 为空时，在入库前用非流式补全
 * 与 wash 路由同契约的 verdict/facts/fluff，避免「红字气泡全无」。
 * wash 主提示（V9.1）须保持同步；备用提示仅在本文件用于 content_filter 空响应时的降级。
 */
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

/** 与 `src/app/api/v1/wash/route.ts` 内 systemPrompt 保持语义一致 */
const SYSTEM_PROMPT = `[SYSTEM OVERRIDE: TruthDecoder PRO - Asset Recast Engine V9.1]
You are a top-tier short-selling analyst. Rebuild the source material into structured intelligence JSON.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE LANGUAGE ISOLATION LAW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"cn" fields: 100% PURE CHINESE ONLY. No English letters, no abbreviations. Translate all terms (CEO → 首席执行官).
"en" fields: 100% PURE ENGLISH ONLY. ZERO Chinese characters. ZERO bilingual parentheticals. Every single character must be English.
This is a PHYSICAL HARD BLOCK. Violations corrupt the entire output.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DISSECTION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. No Emoji symbols.
2. Minimum 100 characters per fluff entry. Must include [Surface Disguise], [Core Mechanism], [Harvest Cost].
3. Use DuPont analysis, game theory, or MECE for deep deconstruction. No hollow descriptions.
4. Uniqueness: fluff keys must be unique and verbatim from source text.
5. NO newline characters (\\n) inside JSON string values.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY JSON OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "verdict": { "cn": "一句话中文判决。", "en": "A ruthless English verdict." },
  "facts": { "cn": ["中文事实1", "中文事实2", "中文事实3"], "en": ["English fact 1", "English fact 2", "English fact 3"] },
  "fluff": {
    "cn": ["原文词汇的中文翻译::[表层伪装]中文分析...[核心机制]中文分析...[收割代价]中文分析..."],
    "en": ["OriginalEnglishTerm::[Surface Disguise] English analysis...[Core Mechanism] English analysis...[Harvest Cost] English analysis..."]
  }
}`;

/**
 * 中性表述备用：降低与部分信源组合时触发 content_filter 的概率；契约字段与主提示一致。
 */
const SYSTEM_PROMPT_FALLBACK = `[SYSTEM: TruthDecoder - Structured Text Recovery V1]
You output ONE JSON object only. No markdown outside JSON.
LANGUAGE: "cn" fields must be Simplified Chinese only (no English letters). "en" fields must be English only.
TASK: Read the source text and produce verdict, facts, and fluff entries for UI highlighting.
Rules for fluff.cn: each string MUST be "verbatimPhraseFromSource::[表层伪装]...[核心机制]...[收割代价]..." with at least 80 Chinese characters after ::.
Use neutral descriptive analysis only; no investment advice; no legal conclusions.
FORMAT:
{
  "verdict": { "cn": "一句话中文摘要。", "en": "One-sentence English summary." },
  "facts": { "cn": ["中文事实1", "中文事实2", "中文事实3"], "en": ["English fact 1", "English fact 2", "English fact 3"] },
  "fluff": { "cn": ["..."], "en": ["..."] }
}`;

type IntelShape = {
  verdict: { cn: string; en: string };
  facts: { cn: string[]; en: string[] };
  fluff: { cn: string[]; en: string[] };
};

function normalizeIntel(
  intel: {
    verdict?: { cn?: string; en?: string };
    facts?: { cn?: string[]; en?: string[] };
    fluff?: { cn?: string[]; en?: string[] };
  }
): IntelShape {
  return {
    verdict: {
      cn: intel.verdict?.cn || '解析失败',
      en: intel.verdict?.en || 'Parse failed.',
    },
    facts: {
      cn: Array.isArray(intel.facts?.cn) ? intel.facts.cn : [],
      en: Array.isArray(intel.facts?.en) ? intel.facts.en : [],
    },
    fluff: {
      cn: Array.isArray(intel.fluff?.cn) ? intel.fluff.cn : [],
      en: Array.isArray(intel.fluff?.en) ? intel.fluff.en : [],
    },
  };
}

function tryParseIntel(raw: string | undefined): IntelShape | null {
  if (!raw?.trim()) return null;
  try {
    const intel = JSON.parse(raw) as {
      verdict?: { cn?: string; en?: string };
      facts?: { cn?: string[]; en?: string[] };
      fluff?: { cn?: string[]; en?: string[] };
    };
    return normalizeIntel(intel);
  } catch {
    return null;
  }
}

/**
 * 多策略请求：与情报体征短调用类似，缓解 json_object 偶发空正文与 content_filter。
 */
async function fetchRegenJson(
  systemPrompt: string,
  userContent: string
): Promise<string> {
  const strategies: Array<{
    response_format?: { type: 'json_object' };
    temperature: number;
  }> = [
    { response_format: { type: 'json_object' }, temperature: 0.25 },
    { response_format: { type: 'json_object' }, temperature: 0.35 },
    { temperature: 0.35 },
  ];

  for (let i = 0; i < strategies.length; i++) {
    if (i > 0) {
      await new Promise((r) => setTimeout(r, 400 * i));
    }
    const strat = strategies[i];
    const userMsg =
      strat.response_format !== undefined
        ? userContent
        : `${userContent}\n\n【输出要求】仅输出一个合法 JSON 对象，不要 Markdown 围栏。`;

    const completion = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMsg },
      ],
      ...strat,
      max_tokens: 8192,
    });

    const text = completion.choices[0]?.message?.content;
    if (typeof text === 'string' && text.trim().length > 0) {
      return text.trim();
    }
  }
  return '';
}

/**
 * 当首页 ingest SSE 截断导致客户端 fluff 为空时，在入库前补全 verdict/facts/fluff。
 */
export async function regenerateFullIntelJsonFromRaw(
  rawContent: string
): Promise<IntelShape> {
  const userContent = rawContent.slice(0, 120_000);

  const rawPrimary = await fetchRegenJson(SYSTEM_PROMPT, userContent);
  const intelPrimary = tryParseIntel(rawPrimary);

  if (intelPrimary && intelPrimary.fluff.cn.length > 0) {
    return intelPrimary;
  }

  const rawFallback = await fetchRegenJson(SYSTEM_PROMPT_FALLBACK, userContent);
  const intelFallback = tryParseIntel(rawFallback);

  if (intelFallback && intelFallback.fluff.cn.length > 0) {
    if (intelPrimary) {
      return {
        verdict:
          intelPrimary.verdict.cn !== '解析失败'
            ? intelPrimary.verdict
            : intelFallback.verdict,
        facts:
          intelPrimary.facts.cn.length > 0
            ? intelPrimary.facts
            : intelFallback.facts,
        fluff: intelFallback.fluff,
      };
    }
    return intelFallback;
  }

  if (intelPrimary) {
    return intelPrimary;
  }
  if (intelFallback) {
    return intelFallback;
  }

  throw new Error('兜底全量 JSON 返回空');
}
