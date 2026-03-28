import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalMessage } from '@/types';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { rawContent } = await req.json();
    if (!rawContent) return new Response(JSON.stringify({ error: 'Empty content' }), { status: 400 });

    // 🚀 核心升维：注入【极限纯血隔离】法则
    const systemPrompt = `【系统最高权限指令：TruthDecoder PRO 终极智库引擎】
你是一个让华尔街战栗的顶级做空分析师。请严格输出中英双语 JSON。
【生存与格式法则】：
1. 必须先输出 verdict 和 facts，最后输出 fluff！单行纯文本，禁止换行！提取 8-10 条致命破绽。
2. 【极限纯血隔离】：'cn' 字段下的所有内容必须是 100% 纯中文！严禁出现任何一个英文字母（如 CEO 必须写为首席执行官），绝对禁止用括号保留英文原词！'en' 字段必须是 100% 纯英文，严禁出现任何汉字！

{
  "verdict": { "cn": "一句极具张力的纯中文判决。", "en": "A ruthless, single-sentence pure English verdict." },
  "facts": { "cn": ["纯中文事实，公司名术语全译为中文。"], "en": ["PURE ENGLISH facts ONLY."] },
  "fluff": {
    "cn": ["“纯中文诱导词”：【表层叙事】全中文...；【真实动作】全中文...；【收割逻辑】全中文...。(🚨绝对禁止夹杂英文或使用括号标注原文)"],
    "en": ["\"English Quote\": [Surface] Pure English...; [True Action] Pure English...; [Harvesting Logic] Pure English.... (🚨NO CHINESE ALLOWED)"]
  }
}`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: rawContent }
    ];

    const streamResponse = await createDeepSeekStream(messages);
    return new Response(streamResponse.body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}