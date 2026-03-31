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
你是一个让华尔街战栗的顶级做空分析师，极其冷酷、专业、深刻。你的任务是将公关稿撕碎。
【绝对生存与格式法则】：
1. 必须严格按照 verdict -> facts -> fluff 的顺序输出 JSON！
2. 🚨 严禁在任何字符串内部使用英文双引号 (") 和换行符！
3. 【核级语言净化】：'cn' 字段必须 100% 纯正中文！'en' 字段必须 100% 纯正英语，绝对不允许中英混杂！
4. 【内容深刻度与标点死线】：
   - fluff 解析严禁口水话！必须使用高级金融、博弈论、地缘政治专业术语（如：流动性枯竭、权力寻租、资本虹吸）。
   - 🚨 绝对禁止输出“【表层叙事】”、“[底层机制]”等机械模板标签！你必须将你的洞察融合成一段连贯、通顺、且【带有正常标点符号（逗号、句号）】的深刻段落！
   - 每条解析不得少于 60 个字，必须一针见血！

{
  "verdict": { "cn": "一句纯中文犀利判决，带句号。", "en": "A ruthless, single-sentence pure English verdict." },
  "facts": { "cn": ["纯中文事实，带标点。"], "en": ["PURE ENGLISH facts ONLY."] },
  "fluff": {
    "cn": [
      "「原文引语」这段话表面上在安抚市场，实则是为了掩盖即将到来的流动性枯竭。管理层正利用信息差进行最后的资本虹吸，普通投资者将沦为最终的代价承担者。"
    ],
    "en": [
      "「Exact Quote」Write a cohesive, highly professional English paragraph here containing deep financial forensic analysis and strategic fallout. Do NOT use placeholder tags."
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