import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalMessage } from '@/types';
import { logger } from '@/utils/logger';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    logger.start('接收到暗影卷宗 (Shadow Dossier) 流式生成请求');

    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) {
      logger.crash('暗影卷宗网关 - 越权访问尝试已被拦截');
      return new Response(JSON.stringify({ error: 'Unauthorized: Clearance Level Too Low' }), { status: 401 });
    }

    const body = await request.json();
    const { rawContent, lang } = body as { rawContent: string; lang?: 'cn' | 'en' };

    if (!rawContent || typeof rawContent !== 'string') {
      logger.crash('暗影卷宗网关 - 缺少有效的情报文本');
      return new Response(JSON.stringify({ error: '缺少有效的情报文本' }), { status: 400 });
    }

    const isEnglish = lang === 'en';
    const systemGuardrail: TerminalMessage = {
      role: 'system',
      content: isEnglish
        ? `You are the Chief Shadow Intelligence Officer of TruthDecoder PRO.
Task: Based on the provided commercial press release, generate a coherent, highly penetrating "Shadow Dossier" memo.
Requirements:
1. Must be a coherent deep-dive analysis, not just bullet points.
2. Strip away official PR fluff and directly expose capital movements, power transitions, or covered-up crises.
3. [CORE REQUIREMENT]: Draw analogies across domains! Introduce at least 1-2 profound cross-disciplinary analogies (e.g., comparing budget cuts to biological "hibernation," strategic partnerships to "letters of marque" from the Age of Discovery, or invoking game theory/historical financial crises). Analyze multidimensional logic (capital flows, political maneuvers, mass psychology).
4. Tone: Cold, professional, piercing, mind-expanding, and highly rewarding to read.
5. [INTERACTIVE INJECTION]: To drastically increase information density, you MUST frequently use a special double-bracket syntax to inject "Shadow Footnotes" into the text. Format: \`[[Surface Buzzword::The dark truth or deep analysis behind it]]\`. Example: \`This [[restructuring::is actually a targeted purge of middle management to make room for the new CEO's loyalists]] will lead to...\` You MUST include at least 10-15 of these shadow footnotes throughout the article!
6. NO JSON! Output a well-formatted Markdown article. MUST BE IN NATIVE ENGLISH (NO CHINESE).`
        : `你现在是 TruthDecoder PRO 的首席暗影情报官。
任务：基于用户提供的商业通稿，生成一份连贯的、极具穿透力的【暗影卷宗 (Shadow Dossier)】长文报告。
要求：
1. 必须是一篇连贯的深度分析文章，而非简单的要点罗列。
2. 扒光官方话术的伪装，直接揭露资本动向、权力交接或掩盖的危机。
3. 【核心指标】：必须触类旁通！引入至少 1-2 个跨领域的深刻类比（例如：将缩减预算比作生物学上的“冬眠保命机制”，将战略合作比作大航海时代的“私掠许可证”，或引入历史金融危机、博弈论等模型），挖掘深度的多维逻辑（资金盘、政治博弈、大众心理）。
4. 语言风格：冷酷、专业、一针见血、让人醍醐灌顶，收获感爆棚。
5. 【互动注入指令】：为了增加阅读的探索感和信息密度，你必须在正文中频繁使用特殊的双括号语法注入“暗影注脚”。格式为：\`[[表层的诱导词汇::这背后的黑暗真相或深度剖析]]\`。例如：\`这次[[架构优化::实质上是针对中层干部的定向清洗，为了给新CEO的嫡系腾出坑位]]将带来...\`。整篇文章必须至少包含 10-15 个这样的暗影注脚！
6. 严禁输出 JSON！直接输出富含逻辑层次的 Markdown 格式排版长文。`
    };

    const userMessage: TerminalMessage = {
      role: 'user',
      content: isEnglish
        ? `Please conduct a deep shadow decryption of the following narrative:\n\n${rawContent}`
        : `请对以下通稿进行深度暗影破译：\n\n${rawContent}`
    };

    const messages: TerminalMessage[] = [systemGuardrail, userMessage];

    logger.async(`呼叫底层大模型流式引擎 (Target Language: ${lang || 'cn'})`);

    const streamResponse = await createDeepSeekStream(messages);

    logger.success('暗影卷宗流式管道已连接，开始向客户端泵入字节流');

    return new Response(streamResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '暗影卷宗流式网关级联失效';
    logger.crash(errMsg);
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
}