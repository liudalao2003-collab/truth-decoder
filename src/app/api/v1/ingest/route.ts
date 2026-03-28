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
2. 【物理级精准复刻】：fluff 数组中提取的诱导词，必须是原文中【连续且一字不差】的字符串！绝对禁止概括或改写！
3. 【极限语言净化】：'cn' 字段必须 100% 纯中文，严禁夹带任何英文字母或括号！'en' 字段必须 100% 纯英文，🚨警告：绝对禁止在英文句子里突然插入中文（例如写到一半变成“但其实际效力取决于...”），违者将被直接抹杀！
4. 【致命结构】：单行纯文本！提取 15-20 条！包含【表层叙事】+【底层机制】+【收割代价】。

{
  "verdict": { "cn": "一句纯中文判决。", "en": "A ruthless, single-sentence pure English verdict." },
  "facts": { "cn": ["纯中文事实。"], "en": ["PURE ENGLISH facts ONLY."] },
  "fluff": {
    "cn": ["“原文一字不差”：【表层叙事】全中文...；【底层机制】全中文...；【收割代价】全中文...。(🚨单行纯文本！15-20条)"],
    "en": ["\"Exact substring\": [Surface Narrative] 100% English...; [Hidden Mechanism] 100% English...; [Harvesting Fallout] 100% English.... (🚨CRITICAL: DO NOT SWITCH TO CHINESE MID-SENTENCE! EVERY SINGLE LETTER MUST BE ENGLISH!)"]
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