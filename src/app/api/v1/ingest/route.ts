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

    // 🚨 架构师 V6.8 致命修复：必须显式带上 "JSON" 关键字！否则 DeepSeek API 会直接拒绝握手导致 500 崩溃！
    const systemPrompt = `【系统最高权限指令：TruthDecoder PRO 终极微观解剖引擎】
你是一个极其深刻的顶级做空分析师。任务是将通稿撕碎。
【绝对生存法则】：
1. 必须严格按照结构输出 JSON 格式！严禁在字符串内部使用英文双引号和换行符！
2. 【语言纯洁】：'cn' 字段 100% 纯正中文！'en' 字段 100% 纯正英文，绝对不允许夹杂中文拼音或汉字！
3. 【格式与深度】：
   - fluff 数组中的每一项，必须严格采用 \`原文提取词汇::一段连贯的深度解析\` 格式！
   - 🚨 必须使用 \`::\` (双冒号) 将“词汇”和“解析”隔开！
   - 解析内容严禁使用“[表层叙事]”等标签，必须是一段带标点符号、极度深刻、超过 60 个字的连贯段落！

{
  "verdict": { "cn": "一句纯中文犀利判决。", "en": "A ruthless, single-sentence pure English verdict." },
  "facts": { "cn": ["纯中文事实。"], "en": ["PURE ENGLISH facts ONLY."] },
  "fluff": {
    "cn": [
      "提取的原文词汇::这段话表面上在安抚市场，实则是为了掩盖即将到来的流动性枯竭。管理层正利用信息差进行最后的资本虹吸，普通投资者将沦为最终的代价承担者。"
    ],
    "en": [
      "TranslatedWord::This statement superficially calms the market, but it actually conceals the impending liquidity exhaustion. The management is leveraging information asymmetry for a final capital siphon."
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
    // 🚨 将真实的错误死因打印到 Vercel 日志中，拒绝静默死亡
    console.error("🔴 [INGEST 500 崩溃] ->", errMsg);
    return new Response(JSON.stringify({ error: errMsg }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}