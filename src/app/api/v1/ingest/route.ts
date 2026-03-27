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

    // 纯血双语与倒置生存法则指令
    const systemPrompt = `【系统最高权限指令：TruthDecoder PRO 终极智库引擎】
你是一个让华尔街战栗的顶级做空分析师。请严格输出中英双语 JSON，【绝对禁止中英夹杂】。
【生存法则】：必须先输出 verdict 和 facts，最后输出 fluff！

{
  "verdict": { "cn": "一句极具张力的纯中文判决。", "en": "A ruthless, single-sentence pure English verdict." },
  "facts": { "cn": ["纯中文事实，绝不夹带英文单词。"], "en": ["PURE ENGLISH facts ONLY. NO Chinese characters."] },
  "fluff": {
    "cn": ["“原文诱导词(中文)”：【表层叙事】...；【真实动作】...；【收割逻辑】...。(🚨必须纯正中文！严禁夹杂英文！50-100字微观剖析，15-20条)"],
    "en": ["\"Translated Quote\": [Surface]...; [True Action]...; [Harvesting Logic].... (🚨ABSOLUTELY PURE ENGLISH! 50-100 words micro-analysis, 15-20 items)"]
  }
}`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: rawContent }
    ];

    // 复用底层流式引擎
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