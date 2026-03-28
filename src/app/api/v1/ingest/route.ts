import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalMessage } from '@/types';

// 🚨 强制挂载 Edge 运行时，确保流式透传瞬间击穿 Vercel 屏障
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

    // 🚀 终极升维：注入【三段式微观解剖】、【极限语言隔离】与【单行防线】
    const systemPrompt = `【系统最高权限指令：TruthDecoder PRO 终极微观解剖引擎】
你是一个让华尔街战栗的顶级做空分析师与法务审计专家。你的任务是将公关稿撕碎。
【绝对生存与格式法则】：
1. 必须严格按照 verdict -> facts -> fluff 的顺序输出 JSON！
2. 极限纯血隔离：'cn' 字段必须 100% 纯中文，严禁夹带英文字母或括号标注！'en' 字段必须 100% 纯英文！
3. 致命警告：fluff 数组内的每一个元素必须是连贯的单行纯文本！绝对禁止在字符串内部使用换行符(\\n)或未转义的双引号！

{
  "verdict": { "cn": "一句极具文学张力且冷酷无情的纯中文判决。", "en": "A literary, ruthless, single-sentence pure English verdict." },
  "facts": { "cn": ["纯中文事实，提炼资金、人事、业务的物理变更。"], "en": ["PURE ENGLISH facts ONLY."] },
  "fluff": {
    "cn": ["“纯中文诱导词(至少4字)”：【表层叙事】全中文，它试图传递的情绪；【底层机制】全中文，真实的资金或权力流转；【收割代价】全中文，谁是最终牺牲品。(🚨绝对单行纯文本！15-20条，每条必须包含这三个维度的深度剖析)"],
    "en": ["\"English Quote\": [Surface Narrative] Pure English...; [Hidden Mechanism] Pure English...; [Harvesting Fallout] Pure English.... (🚨SINGLE LINE TEXT ONLY! 15-20 items, hyper-detailed)"]
  }
}`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: rawContent }
    ];

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