import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalMessage } from '@/types';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const body = await req.json();
    const { content, targetLang } = body as { content: string, targetLang: 'cn'|'en' };

    // 🚨 架构师 V7.1 致命修复：断绝翻译过程中的注意力残留，强制执行“语言清空”
    const systemPromptText = targetLang === 'en'
      ? `You are an elite financial translator. Translate the text into 100% FLUENT, NATIVE ENGLISH.
[CRITICAL]:
1. ZERO CHINESE: Every single character must be converted. No Chinese names, terms, or parenthetical explanations.
2. FOOTNOTE SYNTAX: Preserve [[TranslatedTerm::TranslatedAnalysis]]. Both sides MUST be English.
3. No intro/outro. Output raw Markdown only.`
      : `【系统最高权限指令：极限语言纯洁性与符号锚定】
你是一名顶级的金融翻译官。请将“暗影卷宗”翻译为 100% 纯正的中文。
【强制要求】：
1. 绝对禁止在译文中出现任何一个英文字母！所有缩写（如 CEO, R&D）必须翻译为对应的中文职务或称谓。
2. 物理格式锁：必须保留 [[ ]] 和 :: 的连接格式，且注脚内部也必须全中文。
3. 严禁输出 JSON 或废话。`;

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