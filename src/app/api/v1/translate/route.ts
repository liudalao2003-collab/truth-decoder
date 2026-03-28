import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalMessage } from '@/types';
import { logger } from '@/utils/logger';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const body = await req.json();
    const { content, targetLang } = body as { content: string, targetLang: 'cn'|'en' };

    const systemPromptText = targetLang === 'en'
      ? `[CRITICAL DIRECTIVE]: EXTREME LANGUAGE PURITY AND SYNTAX LOCK.
You are a top-tier financial translator. Translate the following "Shadow Dossier" into 100% NATIVE ENGLISH.
RULES:
1. [SYNTAX LOCK - CRITICAL]: The text contains exactly 15-20 footnotes formatted as [[Word::Insight]]. You MUST preserve this exact syntax without adding spaces around the brackets or colons. Example: translate \`[[优化::裁员]]\` EXACTLY to \`[[Optimization::Layoffs]]\`. DO NOT drop any footnotes!
2. TRANSLATE EVERY SINGLE WORD INTO ENGLISH. Absolutely NO Chinese characters allowed anywhere. DO NOT switch languages mid-sentence.
3. DO NOT put original terms in parentheses. Output ONLY the final English translation in Markdown.`
      : `【系统最高权限指令：极限语言纯洁性与符号锚定】
你是一名顶级的金融翻译官。请将以下的“暗影卷宗”翻译为 100% 纯正的中文。
【死命令】：
1. 【物理符号锚定】：原文中含有 15-20 个严格的 [[Word::Insight]] 注脚。翻译时，必须绝对保留 [[ ]] 和 :: 的无空格连接格式！例如：将 \`[[Optimization::Layoffs]]\` 翻译为 \`[[优化::裁员]]\`。绝对不准丢失任何一个注脚气泡！
2. 彻底翻译所有内容为中文。绝对禁止在译文中出现任何一个英文字母！
3. 绝对禁止在译文中用括号保留英文原词。
4. 严禁输出 JSON，只输出 Markdown 纯文本。`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: String(systemPromptText) },
      { role: 'user', content: String(content) }
    ];

    const streamResponse = await createDeepSeekStream(messages);
    return new Response(streamResponse.body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}