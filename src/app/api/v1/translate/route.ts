import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalMessage } from '@/types';

export const runtime = 'edge';

/**
 * 核心业务：暗影卷宗懒翻译网关
 *
 * V9.4 修复：从 MIXED SOURCE HANDLING 中移除所有中文示例字符。
 * 根因：前版本在 system prompt 中嵌入了中文词汇作为示例，导致 AI 看到中文示例后
 * "语言防线被激活"，反而在输出中夹带中文。本版改为纯英文描述，彻底切断污染源。
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const body = await req.json();
    const { content, targetLang } = body as { content: string, targetLang: 'cn'|'en' };

    const systemPromptText = targetLang === 'en'
      // 🔧 BUG-1 FIX: 英译中时加固语言隔离，防止 AI 在注脚内夹带中文
      ? `You are an elite financial translator. Your ONLY job is to produce 100% FLUENT, NATIVE ENGLISH Markdown.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE LANGUAGE LAW — ZERO TOLERANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ZERO CHINESE. ZERO CHINESE. ZERO CHINESE.
- Every single character — headings, body paragraphs, footnotes inside [[...]], bullet points — MUST be English.
- FORBIDDEN: Any Chinese character (Unicode U+4E00–U+9FFF), Pinyin, or bilingual parentheticals (e.g. a Chinese word followed by its English translation in parentheses).
- The [[Term::Analysis]] footnote format MUST be preserved. BOTH sides of :: must be 100% English.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MIXED SOURCE HANDLING — CRITICAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The source text may already contain mixed Chinese-English content, where Chinese words or phrases
appear embedded inside otherwise English sentences (for example, a Chinese noun phrase inserted
between English words, or Chinese verbs interrupting an English clause).
You MUST identify and translate every such embedded Chinese segment into its natural English
equivalent. Do NOT treat any Chinese characters as "proper nouns" or "untranslatable terms."
No Chinese character (Unicode range U+4E00 through U+9FFF) shall remain anywhere in the final
output. This is a PHYSICAL HARD BLOCK with ZERO exceptions.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Do NOT add any introduction, explanation, or closing remarks.
- Output raw translated Markdown ONLY. Preserve all ## headings, ### sub-headings, bullet points, and [[...::...]] footnote syntax.`

      // 中文翻译保持原有逻辑，但同样加固
      : `【系统最高权限指令：极限语言纯洁性与符号锚定 V9.0】
你是一名顶级的金融翻译官。请将下方"暗影卷宗"从英文原文翻译为 100% 纯正的中文。

【绝对语言死令】：
1. 译文中禁止出现任何一个英文字母！所有缩写（如 CEO, R&D, IPO）必须翻译为对应的中文称谓。
2. 物理格式锁：必须完整保留 [[ ]] 和 :: 的注脚格式，且注脚内部也必须全中文。
3. 严禁输出任何 JSON、前言或废话。只输出翻译后的 Markdown 原文。`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: String(systemPromptText) },
      { role: 'user', content: String(content) }
    ];

    // 翻译同样使用标准 8192 上限
    const streamResponse = await createDeepSeekStream(messages, false, { presence_penalty: 0.2 });
    return new Response(streamResponse.body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '翻译网关物理级崩塌';
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
}