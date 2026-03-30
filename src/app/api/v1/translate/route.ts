import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalMessage } from '@/types';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const body = await req.json();
    const { content, targetLang } = body as { content: string, targetLang: 'cn'|'en' };
    
    const systemPromptText = targetLang === 'en'
      ? `[CRITICAL DIRECTIVE]: TOTAL ERADICATION OF CHINESE CHARACTERS...`
      : `【系统最高权限指令：极限语言纯洁性与符号锚定】...`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: String(systemPromptText) },
      { role: 'user', content: String(content) }
    ];

    const streamResponse = await createDeepSeekStream(messages);
    return new Response(streamResponse.body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });
  } catch (error: unknown) {
    // 🚀 核心修复：执行类型收缩
    const errMsg = error instanceof Error ? error.message : '翻译网关物理级崩塌';
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
}