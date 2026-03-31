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
2. 【JSON 绝对安全结构 - 物理死线】：
   - 🚨 严禁在任何字符串的值内部使用英文双引号 (")！如果原文包含双引号，必须物理替换为中文单引号（‘）或直接删掉！
   - 🚨 严禁在字符串内部输出真实的换行符（Enter）！如果必须换行，请连写！
3. 【物理级精准复刻】：fluff 数组中提取的原话【必须】用中文直角引号「 」包裹！
4. 【核级语言净化】：
   - 'cn' 字段必须 100% 纯中文！
   - 'en' 字段中，「 」内提取的原话必须与原文一致（可为中文），但其后的【表层叙事】【底层机制】【收割代价】必须是 100% 纯正英文！
5. 【致命结构】：单行纯文本！包含【表层叙事】+【底层机制】+【收割代价】。提取 15-20 条！

{
  "verdict": { "cn": "一句纯中文判决。", "en": "A ruthless, single-sentence pure English verdict." },
  "facts": { "cn": ["纯中文事实。"], "en": ["PURE ENGLISH facts ONLY."] },
  "fluff": {
    "cn": [
      "「原文一字不差的原话」【表层叙事】全中文...【底层机制】全中文...【收割代价】全中文..."
    ],
    "en": [
      "「Exact substring from text」[Surface Narrative] 100% PURE ENGLISH ONLY... [Hidden Mechanism] 100% PURE ENGLISH ONLY... [Harvesting Fallout] 100% PURE ENGLISH ONLY..."
    ]
  }
}`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: rawContent }
    ];

    const streamResponse = await createDeepSeekStream(messages, true);
    return new Response(streamResponse.body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' }
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '解剖引擎级联失效';
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
}