import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalMessage } from '@/types';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const body = await req.json();
    const { content, targetLang } = body as { content: string, targetLang: 'cn'|'en' };
    
    // 🚨 V6.5 修复：绝对语言隔离墙
    const systemPromptText = targetLang === 'en'
      ? `You are an elite financial translator. Translate the provided "Shadow Dossier" strictly into English.
【CRITICAL RULES】:
1. FULL TRANSLATION: Translate the ENTIRE text. Do not stop halfway.
2. 100% PURE ENGLISH: The output MUST be entirely in English. If you leave a SINGLE Chinese character in the output, the system will crash. Even the terms inside footnotes MUST be translated.
3. FOOTNOTE FORMAT: Strictly preserve the exact formatting of footnotes: [[TranslatedWord::TranslatedInsight]]. Do NOT add spaces around the double colons.
4. Output raw Markdown text only.`
      : `【系统最高权限指令：极限语言纯洁性与符号锚定】
你是一名顶级的金融翻译官。请将“暗影卷宗”翻译为 100% 纯正的中文。
【死命令】：
1. 绝对保留 [[ ]] 和 :: 的无空格连接格式！
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
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '翻译网关物理级崩塌';
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
}