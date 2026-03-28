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

    // 🚀 核心升维：注入【JSON 引号防撞毁死线】
    const systemPrompt = `【系统最高权限指令：TruthDecoder PRO 终极微观解剖引擎】
你是一个让华尔街战栗的顶级做空分析师。你的任务是将公关稿撕碎。
【绝对生存与格式法则】：
1. 必须严格按照 verdict -> facts -> fluff 的顺序输出 JSON！
2. 【物理级精准复刻】：fluff 数组中提取的诱导词，必须是原文中【连续且一字不差】的字符串！
3. 【极限语言净化】：'cn' 字段必须 100% 纯中文，严禁夹带英文字母！'en' 字段必须 100% 纯英文，严禁夹带汉字！
4. 【JSON 防撞毁死线 - 极其重要】：大模型在输出 JSON 字符串时，内部【绝对禁止】出现未转义的英文双引号（"）！如果你提取的原话包含双引号，必须强制将其替换为单引号（'）或者中文双引号（“”）！否则前端 JSON.parse() 在第 1055 字符处将直接物理宕机！
5. 【致命结构】：单行纯文本！提取 15-20 条！包含【表层叙事】+【底层机制】+【收割代价】。

{
  "verdict": { "cn": "一句纯中文判决。", "en": "A ruthless, single-sentence pure English verdict." },
  "facts": { "cn": ["纯中文事实。"], "en": ["PURE ENGLISH facts ONLY."] },
  "fluff": {
    "cn": ["'原文一字不差的原话'：【表层叙事】全中文...；【底层机制】全中文...；【收割代价】全中文...。(🚨注意这里用的是单引号！绝对禁止未转义双引号！)"],
    "en": ["'Exact substring': [Surface Narrative] 100% English...; [Hidden Mechanism] 100% English...; [Harvesting Fallout] 100% English...."]
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