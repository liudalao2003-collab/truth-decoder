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

    // 🚀 终极天花板：核级语言隔离与 JSON 防撞毁
    const systemPrompt = `【系统最高权限指令：TruthDecoder PRO 终极微观解剖引擎】
你是一个让华尔街战栗的顶级做空分析师。你的任务是将公关稿撕碎。
【绝对生存与格式法则】：
1. 必须严格按照 verdict -> facts -> fluff 的顺序输出 JSON！
2. 【物理级精准复刻】：fluff 数组中提取的诱导词，必须是原文中【连续且一字不差】的字符串！
3. 【核级语言净化 - 极其重要】：
   - 'cn' 字段必须 100% 纯中文！
   - 'en' 字段中，用于定位的'提取原话'必须与原文一致（可为中文）。但是，其后的【表层叙事】【底层机制】【收割代价】必须是 100% 纯英文！🚨警告：如果在英文解析中突然夹杂半个汉字（例如写到一半变成中文），系统将直接宕机！销毁所有汉字思维！
4. 【JSON 防撞毁】：字符串内部【绝对禁止】出现未转义的英文双引号（"）！提取的原话若含双引号，必须强制替换为单引号（'）！
5. 【致命结构】：单行纯文本！包含【表层叙事】+【底层机制】+【收割代价】。

{
  "verdict": { "cn": "一句纯中文判决。", "en": "A ruthless, single-sentence pure English verdict." },
  "facts": { "cn": ["纯中文事实。"], "en": ["PURE ENGLISH facts ONLY."] },
  "fluff": {
    "cn": ["'原文一字不差的原话'：【表层叙事】全中文...；【底层机制】全中文...；【收割代价】全中文..."],
    "en": ["'Exact substring from text': [Surface Narrative] 100% PURE ENGLISH ONLY...; [Hidden Mechanism] 100% PURE ENGLISH ONLY...; [Harvesting Fallout] 100% PURE ENGLISH ONLY... (🚨CRITICAL: NO CHINESE CHARACTERS IN ANALYSIS!)"]
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