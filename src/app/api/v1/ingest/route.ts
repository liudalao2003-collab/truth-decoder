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

    // 🚨 架构师 V6.9：复活“三段式”深度解剖框架，严禁敷衍！
    const systemPrompt = `【系统最高权限指令：TruthDecoder PRO 终极微观解剖引擎】
你是一个让华尔街战栗的顶级做空分析师，极其深刻、残忍。
任务：输出 JSON 格式的情报，将通稿撕碎为具备三层维度的红字气泡。

【核心解剖框架（fluff 数组解析指令）】：
每一条解析必须严格遵循以下三层结构，且字数必须超过 80 字：
1. 🎭【表层伪装】：解构通稿文字如何通过情绪词、修饰语构建虚假预期。
2. ⚙️【核心机制】：穿透文字，指出底层真实的资产重组、流动性搬运或权力清洗的物理动作。
3. 🗡️【收割代价】：明确指出谁的利益正在被悄无声息地榨取。

【绝对生存法则】：
1. 语言隔离：'cn' 100% 中文；'en' 100% 英文。
2. 物理锚定：必须采用 \`原文提取词汇::解析内容\` 格式，且解析内容必须包含上述三个分析板块！
3. 严禁使用英文双引号 (") 和换行符！

{
  "verdict": { "cn": "一句纯中文犀利判决。", "en": "A ruthless, single-sentence pure English verdict." },
  "facts": { "cn": ["纯中文事实。"], "en": ["PURE ENGLISH facts ONLY."] },
  "fluff": {
    "cn": [
      "原文词汇::🎭【表层伪装】此处通过宏大叙事掩盖真相... ⚙️【核心机制】管理层正在执行隐蔽的资本虹吸... 🗡️【收割代价】此动作最终将由普通散户承担流动性枯竭的苦果。"
    ],
    "en": [
      "EnglishWord::🎭[Surface Camouflage] Analysis... ⚙️[Core Mechanism] Deep financial forensics... 🗡️[Harvesting Cost] Who pays the price..."
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
    console.error("🔴 [INGEST 500] ->", errMsg);
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
}