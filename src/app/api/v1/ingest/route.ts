import { createDeepSeekStream } from '@/services/deepseek-stream';
import { assertIngestAuthorized } from '@/lib/ingest-auth';
import { TerminalMessage } from '@/types';

export const runtime = 'edge';

/**
 * 核心业务：TruthDecoder 终极微观解剖引擎 V9.1
 *
 * V9.1 修复：
 * - 彻底加固 EN 字段语言隔离死令，根治红字气泡英文模式下夹带中文的问题。
 * - EN 字段的 fluff key 必须从原文逐字提取英文词，value 必须 100% 纯英文分析。
 * - 明确告知 AI：如果原文是英文，cn 字段的 key 也必须是该英文词的中文翻译。
 */
export async function POST(req: Request) {
  try {
    const auth = await assertIngestAuthorized(req);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { rawContent } = await req.json();
    if (!rawContent) return new Response(JSON.stringify({ error: 'Empty content' }), { status: 400 });

    const systemPrompt = `[SYSTEM OVERRIDE: TruthDecoder PRO - Micro-Dissection Engine V9.1]
You are a top-tier short-selling analyst. Output intelligence in strict JSON format.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE LANGUAGE ISOLATION LAW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"cn" fields: 100% PURE CHINESE ONLY. No English letters, no abbreviations. Translate all terms (CEO → 首席执行官, IPO → 首次公开募股).
"en" fields: 100% PURE ENGLISH ONLY. ZERO Chinese characters. ZERO bilingual parentheticals like "优化 (optimization)". Every single character must be English.
This is a PHYSICAL HARD BLOCK. Violations corrupt the entire output.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE DISSECTION FRAMEWORK (fluff array)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Each fluff entry MUST follow this structure (minimum 100 characters per entry, NO Emoji):
- [Surface Disguise]: How the language constructs false expectations.
- [Core Mechanism]: Using financial models or game theory, identify the real asset restructuring, liquidity transfer, or power purge.
- [Harvest Cost]: Explicitly name whose interests (shareholders, employees, public) are being silently extracted.

Rules:
1. Uniqueness: No duplicate or semantically similar terms. Each term must represent an independent business logic.
2. Value filter: Only extract terms with deceptive, strategic, or concealing significance.
3. Key rule: The term (left of ::) MUST be copied verbatim from the source text.
4. NO newline characters (\\n) inside JSON string values.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY JSON OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "verdict": { "cn": "一句话中文判决。", "en": "A ruthless English verdict." },
  "facts": { "cn": ["中文事实1", "中文事实2", "中文事实3"], "en": ["English fact 1", "English fact 2", "English fact 3"] },
  "fluff": {
    "cn": ["原文词汇的中文::[表层伪装]中文分析...[核心机制]中文分析...[收割代价]中文分析..."],
    "en": ["OriginalEnglishTerm::[Surface Disguise] English analysis...[Core Mechanism] English analysis...[Harvest Cost] English analysis..."]
  }
}`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: rawContent }
    ];

    const streamResponse = await createDeepSeekStream(messages, true);

    return new Response(streamResponse.body, {
      headers: { 
        'Content-Type': 'text/event-stream', 
        'Cache-Control': 'no-cache', 
        'Connection': 'keep-alive' 
      }
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '解剖引擎级联失效';
    if (process.env.NODE_ENV === 'development') {
      console.error("🔴 [INGEST_CRASH] ->", errMsg);
    }
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
}