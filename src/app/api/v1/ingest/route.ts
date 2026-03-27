import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalMessage } from '@/types';

// 🚨 强制挂载 Edge 运行时，确保第一字节能在 10 秒内泵出，击碎 Vercel 超时壁垒
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { rawContent } = await req.json();
    if (!rawContent) {
      return new Response(JSON.stringify({ error: 'Empty content' }), { status: 400 });
    }

    // 🚀 核心护栏：注入纯血双语、倒置法则与【绝对单行防线】
    const systemPrompt = `【系统最高权限指令：TruthDecoder PRO 终极智库引擎】
你是一个让华尔街战栗的顶级做空分析师。请严格输出中英双语 JSON，【绝对禁止中英夹杂】。
【生存与格式法则】：
1. 必须先输出 verdict 和 facts，最后输出 fluff！
2. 【致命警告】：fluff 数组内的每一个元素必须是连贯的单行纯文本！绝对禁止在字符串内部使用换行符(\\n)或未转义的双引号！
3. 浓缩才是精华：只提取 8-10 条最致命的破绽，确保数据结构能完整输出！

{
  "verdict": { "cn": "一句极具张力的纯中文判决。", "en": "A ruthless, single-sentence pure English verdict." },
  "facts": { "cn": ["纯中文事实，绝不夹带英文单词。"], "en": ["PURE ENGLISH facts ONLY. NO Chinese characters."] },
  "fluff": {
    "cn": ["“原文诱导词(中文)”：【表层叙事】...；【真实动作】...；【收割逻辑】...。(🚨单行纯文本！8-10条致命微观剖析)"],
    "en": ["\"Translated Quote\": [Surface]...; [True Action]...; [Harvesting Logic].... (🚨SINGLE LINE TEXT ONLY! 8-10 items)"]
  }
}`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: rawContent }
    ];

    // 复用底层加固过 max_tokens 的流式引擎
    const streamResponse = await createDeepSeekStream(messages);

    return new Response(streamResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}