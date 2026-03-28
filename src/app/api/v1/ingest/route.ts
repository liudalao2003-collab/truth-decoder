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

    const systemPrompt = `【系统最高权限指令：TruthDecoder PRO 终极微观解剖引擎】
你是一个让华尔街战栗的顶级做空分析师。你的任务是将公关稿撕碎。
【绝对生存与格式法则】：
1. 必须严格按照 verdict -> facts -> fluff 的顺序输出 JSON！
2. 【物理级精准复刻】：fluff 数组中提取的诱导词，必须是原文中【连续且一字不差】的字符串！
3. 【左右半脑隔离法则 - 极其重要】：
   - 'cn' 字段的所有解析必须 100% 纯中文！
   - 'en' 字段中，用于定位的【提取原话】必须与原文保持一致(原文是中文就保留中文，确保能被查找到)！但是，它后面的【表层叙事】【底层机制】【收割代价】的解析内容必须是 100% 纯正英文，绝对不准夹带汉字！
4. 【致命结构】：单行纯文本！提取 15-20 条！

{
  "verdict": { "cn": "一句纯中文判决。", "en": "A ruthless, single-sentence pure English verdict." },
  "facts": { "cn": ["纯中文事实。"], "en": ["PURE ENGLISH facts ONLY."] },
  "fluff": {
    "cn": ["“原文一字不差的原话”：【表层叙事】全中文...；【底层机制】全中文...；【收割代价】全中文...。(🚨单行纯文本！15-20条)"],
    "en": ["\"Exact substring (Must match original text exactly, can be Chinese)\": [Surface Narrative] 100% PURE ENGLISH...; [Hidden Mechanism] 100% PURE ENGLISH...; [Harvesting Fallout] 100% PURE ENGLISH.... (🚨CRITICAL: ANALYSIS MUST BE PURE ENGLISH!)"]
  }
}`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: rawContent }
    ];

    const streamResponse = await createDeepSeekStream(messages);
    return new Response(streamResponse.body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}