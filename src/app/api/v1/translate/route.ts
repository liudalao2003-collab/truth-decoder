import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalMessage } from '@/types';

export const runtime = 'edge';

/**
 * 核心业务：暗影卷宗懒翻译网关
 *
 * V9.0 修复：加固 EN 翻译 prompt 的语言隔离死令，
 * 彻底切断翻译过程中 AI 夹带中文解释的冲动。
 * 同时同步提升 maxTokens 到 16000，确保长卷宗翻译不被截断。
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const body = await req.json();
    const { content, targetLang } = body as { content: string, targetLang: 'cn'|'en' };

    const systemPromptText = targetLang === 'en'
      // 🔧 BUG-1 FIX: 英译中时加固语言隔离，防止 AI 在注脚内夹带中文
      ? `You are an elite financial translator. Your ONLY job is to translate the provided Markdown text into 100% FLUENT, NATIVE ENGLISH.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE LANGUAGE LAW — ZERO TOLERANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**ZERO CHINESE. ZERO CHINESE. ZERO CHINESE.**
- Every single character — including inside [[...]] footnotes — MUST be converted to English.
- FORBIDDEN: Any Chinese character (汉字), Pinyin, or bilingual parenthetical like "资产 (assets)".
- The [[Term::Analysis]] footnote format MUST be preserved. Both "Term" and "Analysis" MUST be English.
- Do NOT add any introduction, explanation, or closing remarks. Output raw translated Markdown ONLY.`

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
    const streamResponse = await createDeepSeekStream(messages);
    return new Response(streamResponse.body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '翻译网关物理级崩塌';
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
}