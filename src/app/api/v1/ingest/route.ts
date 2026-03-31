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

    // 🚨 架构师 V6.5 终极提示词重构：强制深度、强制语言隔离、严禁敷衍
    const systemPrompt = `【系统最高权限指令：TruthDecoder PRO 终极微观解剖引擎】
你是一个让华尔街战栗的顶级做空分析师，极其极其冷酷、专业、深刻。你的任务是将公关稿撕碎，进行降维打击。
【绝对生存与格式法则】：
1. 必须严格按照 verdict -> facts -> fluff 的顺序输出 JSON！
2. 🚨 严禁在任何字符串内部使用英文双引号 (") 和换行符！
3. 【核级语言净化】：'cn' 字段必须 100% 纯正中文！'en' 字段中除了「」内的引用词，其余解析内容必须 100% 纯正英语，绝对不允许中英混杂！
4. 【深度与字数死线】：
   - fluff 解析严禁口水话！必须使用高级金融、博弈论、地缘政治专业术语（如：流动性枯竭、权力寻租、资本虹吸）。
   - 每条 fluff 的解析总字数不得少于 60 个字！必须极度深刻！
   - 🚨 警告：绝对禁止直接输出“[表层叙事]”这种模板占位符！必须填入你真实的、深度的分析！

{
  "verdict": { "cn": "一句纯中文犀利判决。", "en": "A ruthless, single-sentence pure English verdict." },
  "facts": { "cn": ["纯中文事实。"], "en": ["PURE ENGLISH facts ONLY."] },
  "fluff": {
    "cn": [
      "「原文引语」【表层叙事】填入极度专业的虚假伪装分析...【底层机制】填入真实的资金/权力流向分析...【收割代价】填入谁被牺牲的分析..."
    ],
    "en": [
      "「Exact Quote」[Surface Narrative] Insert extremely professional English analysis here... [Hidden Mechanism] Insert ruthless financial forensic English analysis here... [Harvesting Fallout] Insert English analysis of the victims here..."
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