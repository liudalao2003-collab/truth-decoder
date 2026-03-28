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
      ? `[CRITICAL DIRECTIVE]: TOTAL ERADICATION OF CHINESE CHARACTERS.
You are a top-tier financial translator translating a "Shadow Dossier" into English.
RULES:
1. [SYNTAX LOCK]: Preserve exactly all [[Word::Insight]] footnotes. DO NOT add spaces around brackets or colons.
2. [TOTAL ERADICATION]: TRANSLATE EVERY SINGLE CHINESE CHARACTER INTO ENGLISH. The anchor "Word" MUST be translated into English too! For example, \`[[堕落::贪腐代价...]]\` MUST become \`[[Degradation::Cost of corruption...]]\`. 
3. WARNING: If I find a SINGLE Chinese character (e.g., 提示牌, 植入, 推行) in your output, the system will crash. Destroy all Chinese characters!
4. Output ONLY Markdown text. No JSON.`
      : `【系统最高权限指令：极限语言纯洁性与符号锚定】
你是一名顶级的金融翻译官。请将“暗影卷宗”翻译为 100% 纯正的中文。
【死命令】：
1. 绝对保留 [[ ]] 和 :: 的无空格连接格式！例如：将 \`[[Optimization::Layoffs]]\` 翻译为 \`[[优化::裁员]]\`。
2. 彻底翻译所有内容为中文。绝对禁止在译文中出现任何一个英文字母（企业官方简称除外）！
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