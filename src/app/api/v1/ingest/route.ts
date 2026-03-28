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

    // 🚀 终极微观解剖引擎：注入【物理级精准复刻】与【终极语言阉割】
    const systemPrompt = `【系统最高权限指令：TruthDecoder PRO 终极微观解剖引擎】
你是一个让华尔街战栗的顶级做空分析师与法务审计专家。你的任务是将公关稿撕碎。
【绝对生存与格式法则】：
1. 必须严格按照 verdict -> facts -> fluff 的顺序输出 JSON！
2. 【物理级精准复刻】：fluff 数组中提取的“诱导词”，必须是原文中【连续且一字不差】的字符串（至少4个字）！绝对禁止概括或改写，否则前端雷达将彻底瘫痪！
3. 【终极语言阉割】：'cn' 字段的解析内容必须 100% 纯中文！严禁夹带任何英文字母（如 SaaS 必须写“软件服务”，CEO 必须写“首席执行官”，App 必须写“应用程序”），绝对禁止用括号标注英文原词！'en' 字段必须 100% 纯英文，严禁出现汉字！
4. 【致命结构】：fluff 数组内的解析必须是单行纯文本！严禁换行！每条必须严格包含三个维度的显式前缀：【表层叙事】+【底层机制】+【收割代价】。必须疯狂压榨出 15-20 条致命破绽！

{
  "verdict": { "cn": "一句极具文学张力且冷酷无情的纯中文判决。", "en": "A literary, ruthless, single-sentence pure English verdict." },
  "facts": { "cn": ["纯中文事实，提炼资金、人事、业务的物理变更。"], "en": ["PURE ENGLISH facts ONLY."] },
  "fluff": {
    "cn": ["“原文中一字不差的连续词汇(至少4字)”：【表层叙事】全中文，试图传递的情绪；【底层机制】全中文，真实的资金或权力流转；【收割代价】全中文，谁是最终牺牲品。(🚨绝对单行纯文本！15-20条！)"],
    "en": ["\"Exact substring from text\": [Surface Narrative] Pure English...; [Hidden Mechanism] Pure English...; [Harvesting Fallout] Pure English.... (🚨SINGLE LINE TEXT ONLY! 15-20 items!)"]
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