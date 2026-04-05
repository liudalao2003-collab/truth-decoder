/**
 * 情报体征短调用：单独结构化输出，避免与 wash/ingest 主 JSON 契约耦合。
 */

import { BilingualData } from '@/types/database';
import {
  INTEL_PROFILE_SCHEMA_VERSION,
  IntelProfile,
  IntelProfileSchema,
} from '@/types/intel-profile';
import { logger } from '@/utils/logger';

export const INTEL_PROFILE_PROMPT_VERSION = 'intel-profile-v1';

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

async function callDeepSeekJson(systemPrompt: string, userContent: string): Promise<string> {
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
      response_format: { type: 'json_object' },
      temperature: 0.25,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`DeepSeek HTTP ${res.status}: ${t}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('DeepSeek 返回空内容');
  return content;
}

const SYSTEM_PROMPT = `[SYSTEM: TruthDecoder Intel Signature Engine ${INTEL_PROFILE_PROMPT_VERSION}]
You output ONE JSON object only. No markdown outside JSON.

LANGUAGE LAW:
- Every "cn" string: Simplified Chinese only. No English letters in cn fields.
- Every "en" string: English only. No Chinese characters in en fields.

SCORING LAW (0-100 integers):
- narrativeIncitement: emotional leverage, fear/greed hooks, loaded language in the source.
- stakeholderEntanglement: how many distinct power/interest centers are in play (not headcount; structural tension).
- verifiability: how checkable claims are (primary data, filings, traceable facts) — NOT a "truth" verdict.
- actionUrging: push to trade, boycott, panic, or take sides.

RATIONALE LAW:
- For EACH of the four dimensions, provide 1-2 bullets per language.
- Each bullet MUST cite a short verbatim phrase from the source OR reference a fact index like "事实2" / "Fact 2" matching the provided hard facts list order (1-based).

STAKEHOLDERS: 1-12 rows. impact.cn/en: who gains, loses, or is ambiguous (plain language).

VERIFICATION: 3-5 items. Each item describes what to verify and where (regulator site, exchange filing, primary document, etc.) — bilingual.

AUDIT:
- Set audit.model to "deepseek-chat"
- Set audit.generatedAt to ISO-8601 UTC now
- Set audit.promptVersion to "${INTEL_PROFILE_PROMPT_VERSION}"

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
  "stakeholders": [
    { "subject": { "cn": "...", "en": "..." }, "role": { "cn": "...", "en": "..." }, "impact": { "cn": "...", "en": "..." }, "anchor": { "cn": "...", "en": "..." } }
  ],
  "verificationChecklist": [ { "item": { "cn": "...", "en": "..." } } ],
  "audit": { "model": "deepseek-chat", "generatedAt": "...", "promptVersion": "${INTEL_PROFILE_PROMPT_VERSION}" }
}`;

/**
 * 基于原文与已抽取硬事实生成情报体征；失败时抛错，由调用方写入 intelProfileError。
 */
export async function generateIntelProfile(
  rawContent: string,
  hardFacts: BilingualData | string[] | undefined
): Promise<IntelProfile> {
  logger.start('情报体征短调用');
  const { cn, en } = normalizeHardFacts(hardFacts);

  const userBlock = [
    '【SOURCE_TEXT】',
    rawContent.slice(0, 120_000),
    '',
    '【HARD_FACTS_CN_INDEXED】',
    cn.map((t, i) => `${i + 1}. ${t}`).join('\n') || '(none)',
    '',
    '【HARD_FACTS_EN_INDEXED】',
    en.map((t, i) => `${i + 1}. ${t}`).join('\n') || '(none)',
  ].join('\n');

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      logger.async(`情报体征 LLM 第 ${attempt + 1} 次`);
      const raw = await callDeepSeekJson(SYSTEM_PROMPT, userBlock);
      const cleaned = stripJsonFence(raw).replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
      const parsed: unknown = JSON.parse(cleaned);
      const result = IntelProfileSchema.safeParse(parsed);
      if (result.success) {
        logger.success('情报体征契约校验通过');
        return result.data;
      }
      lastErr = result.error;
      if (process.env.NODE_ENV === 'development') {
        console.log('🔴 [模块_崩溃] -> Zod:', result.error.flatten());
      }
    } catch (e) {
      lastErr = e;
      if (process.env.NODE_ENV === 'development') {
        const msg = e instanceof Error ? e.message : String(e);
        console.log('🔴 [模块_崩溃] -> 情报体征解析:', msg);
      }
    }
  }

  const msg =
    lastErr instanceof Error
      ? lastErr.message
      : 'Intel profile validation failed';
  throw new Error(msg);
}
