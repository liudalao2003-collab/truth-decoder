import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalMessage } from '@/types';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const body = await req.json();
    const { content, targetLang } = body as { content: string, targetLang: 'cn'|'en' };

    // 🚀 核心升维：在语种切换的瞬间斩断残余外语
    const systemPromptText = targetLang === 'en'
      ? `[CRITICAL DIRECTIVE]: EXTREME LANGUAGE PURITY.
You are a top-tier financial translator. Translate the following "Shadow Dossier" into 100% NATIVE ENGLISH.
RULES:
1. Maintain [[Surface Buzzword::Deep Insight]] anchor format strictly.
2. TRANSLATE EVERY SINGLE WORD INTO ENGLISH. Absolutely NO Chinese characters allowed anywhere.
3. DO NOT include the original terms in parentheses. Provide ONLY the final English translation.
4. Output ONLY Markdown.`
      : `【系统最高权限指令：极限语言纯洁性隔离】
你是一名顶级的金融翻译官。请将以下的“暗影卷宗”翻译为 100% 纯正的中文。
【死命令】：
1. 严格保留 [[表层词汇::深度注脚]] 的锚点格式。
2. 彻底翻译所有内容为中文。绝对禁止在译文中出现任何一个英文字母！
3. 绝对禁止在译文中用括号保留英文原词！（例如：绝对不允许出现“苹果(Apple)”或“裁员(Layoff)”，只能写“苹果”或“裁员”）。
4. 括号 [[ ]] 内部的表层词汇和注脚，也必须是 100% 的纯中文。
5. 严禁输出 JSON，只输出 Markdown 纯文本。`;

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