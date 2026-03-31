import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalMessage } from '@/types';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const body = await req.json();
    const { content, targetLang } = body as { content: string, targetLang: 'cn'|'en' };
    
    // 🚨 架构师 V6.9 致命修复：断绝翻译过程中的注意力残留，强制要求连注脚内部也必须全英文！
    const systemPromptText = targetLang === 'en'
      ? `You are an elite financial translator. Translate the entire text into 100% FLUENT, NATIVE ENGLISH.

[CRITICAL LANGUAGE RULES]:
1. NO CHINESE CHARACTERS: Translate every single word, idiom, proper noun, and concept into English. Do not leave ANY Chinese characters or Pinyin in your output (e.g., words like "回调", "既成事实" MUST be translated).
2. FOOTNOTE SYNTAX: Preserve the footnote syntax EXACTLY as [[TranslatedTerm::TranslatedAnalysis]]. 
   - 🚨 The "TranslatedTerm" MUST be in English!
   - 🚨 The "TranslatedAnalysis" MUST be in English!
   - Keep the double brackets [[]] and double colons :: intact.
3. Output raw Markdown text only. No intro, no outro.`
      : `【系统最高权限指令：极限语言纯洁性与符号锚定】
你是一名顶级的金融翻译官。请将“暗影卷宗”翻译为 100% 纯正的中文。
【死命令】：
1. 绝对保留 [[ ]] 和 :: 的无空格连接格式！
2. 彻底翻译所有内容为中文。绝对禁止在译文中出现任何一个英文字母！连注脚内部的词汇也必须全中文！
3. 严禁输出 JSON，只输出 Markdown 纯文本。`;

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