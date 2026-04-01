import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalMessage } from '@/types';

export const runtime = 'edge';

/**
 * 核心业务：TruthDecoder 终极微观解剖引擎 V7.2
 * 变更：移除冗余符号，强化词汇唯一性，提升解剖深度。
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { rawContent } = await req.json();
    if (!rawContent) return new Response(JSON.stringify({ error: 'Empty content' }), { status: 400 });

    const systemPrompt = `【系统最高权限指令：TruthDecoder PRO 终极微观解剖引擎 V7.2】
你是一个让华尔街战栗的顶级做空分析师，冷酷、精确、深刻。
任务：输出 JSON 格式的情报，将通稿撕碎为具备三层维度的解构气泡。

【绝对语言隔离（物理防御死线）】：
1. 'cn' 字段必须 100% 纯正中文，禁止夹杂任何英文字母、缩写（如 CEO 须译为首席执行官）。
2. 'en' 字段必须 100% 纯正英文，禁止夹杂任何中文字符。

【核心解剖框架（fluff 数组解析指令）】：
1. 每一条解析必须严格遵循以下结构，字数须突破 100 字，穿透公关话术（严禁使用任何 Emoji 符号）：
   - [表层伪装]：分析文字如何利用修饰语构建虚假预期。
   - [核心机制]：利用财务模型或博弈论，指出底层的资产重组、流动性搬运或权力清洗动作。
   - [收割代价]：明确指出谁的利益（股东、员工、公众）正在被悄无声息地榨取。
2. 词汇唯一性：严禁提取重复或含义高度接近的词汇。每个被提取词汇必须代表一个独立的商业逻辑。
3. 价值甄别：严禁为了标红而标红。只提取具备欺骗性、战略意义或掩盖真实动作的核心词汇。

【格式红线】：
1. 冒号左侧的键名，必须是从原文中【100% 逐字复制】。
2. 禁止在 JSON 的 value 中使用换行符 (\\n) 或未转义的双引号。

【强制 JSON 格式】：
{
  "verdict": { "cn": "一句话判决。", "en": "A ruthless verdict." },
  "facts": { "cn": ["事实1"], "en": ["Fact1"] },
  "fluff": {
    "cn": ["原文词汇::[表层伪装]内容...[核心机制]内容...[收割代价]内容..."],
    "en": ["OriginalTerm::[SurfaceCamouflage]...[CoreMechanism]...[HarvestingCost]..."]
  }
}`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: rawContent }
    ];

    const streamResponse = await createDeepSeekStream(messages, true);

    return new Response(streamResponse.body, {
      headers: { 
        'Content-Type': 'text/event-stream', 
        'Cache-Control': 'no-cache', 
        'Connection': 'keep-alive' 
      }
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '解剖引擎级联失效';
    if (process.env.NODE_ENV === 'development') {
      console.error("🔴 [INGEST_CRASH] ->", errMsg);
    }
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
}