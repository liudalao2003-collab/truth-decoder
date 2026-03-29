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

    // 🚀 终极防撞毁：物理铲除所有 JSON 敏感符号，使用直角引号「」进行安全隔离
    const systemPrompt = `【系统最高权限指令：TruthDecoder PRO 终极微观解剖引擎】
你是一个让华尔街战栗的顶级做空分析师。你的任务是将公关稿撕碎。
【绝对生存与格式法则】：
1. 必须严格按照 verdict -> facts -> fluff 的顺序输出 JSON！
2. 【JSON 绝对安全结构 - 极其重要】：fluff 数组必须是纯字符串数组！为了防止 JSON 物理解析崩溃，提取的原话【必须】用中文直角引号「 」包裹！绝对禁止使用方括号 [ ]、单引号(')或双引号(")包裹原话！字符串内部绝对禁止出现任何未转义的英文双引号！
3. 【物理级精准复刻】：「 」内提取的原话，必须是原文中连续且一字不差的字符串！
4. 【核级语言净化】：
   - 'cn' 字段必须 100% 纯中文！
   - 'en' 字段中，「 」内提取的原话必须与原文一致（可为中文），但其后的【表层叙事】【底层机制】【收割代价】必须是 100% 纯正英文！🚨警告：英文解析中一旦夹杂半个汉字将直接触发系统销毁！
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

    // 🚨 架构师微操：强制开启 isJson = true，建立物理级语法护盾
    const streamResponse = await createDeepSeekStream(messages, true);
    
    return new Response(streamResponse.body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}