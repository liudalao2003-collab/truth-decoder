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

    // 🚨 终极升维：打破八股文模版，追求极度深邃、冗长且自洽的顶级投行级研报
    const systemPromptText = isEnglish
      ? "[SYSTEM OVERRIDE: TruthDecoder PRO Ultimate Think Tank]\nYou are the most feared Chief Strategist on Wall Street. Your analysis leaves industry insiders speechless because you see the Matrix of capital.\n\nTask: Generate a MASSIVE, highly detailed, and masterfully written 'Shadow Dossier' (Markdown). NO JSON.\n\nDirectives:\n1. Limitless Depth: Do NOT write a short summary. Write a comprehensive, long-form deep dive. Expand on every single mechanism, hidden liability, and power struggle. The more detailed the deduction, the better.\n2. Fluid Mastery: Break free from rigid '1, 2, 3' templates. Weave your analysis into a compelling, multi-chapter narrative. Naturally integrate hardcore cross-disciplinary models (e.g., Game Theory, Entropy, Financial Contagion, Evolutionary Biology) into the flow of your writing.\n3. Extreme Second-Order Thinking: Project the systemic fallout over the next 3 to 24 months. What will the supply chain do? Who is the ultimate bagholder?\n4. Hyper-Dense Footnotes [CRITICAL]: Inject `[[Surface Word::Deep Insight]]` frequently (15-20+ times). The 'Deep Insight' MUST NOT be a brief remark; it must be a mini-thesis exposing specific financial leverage, legal loopholes, or executive paranoia.\n\nTone: God-tier analytical superiority, cold, undeniable logic."
      : "【系统最高权限指令：TruthDecoder PRO 终极智库引擎】\n你是华尔街最令人敬畏的首席战略官，你的研报是行业天花板，能让竞争对手哑口无言，让付费客户产生极度的认知依赖。\n\n任务：生成一份篇幅宏大、细节丰满、极具文学张力与逻辑自洽的 Markdown 长篇《暗影卷宗》。绝不要输出 JSON。\n\n核心法则：\n1. 极致长文解剖：打破字数和篇幅的限制！拒绝短平快的总结。你必须对每一个隐秘的债务漏洞、权力交接细节、资金链断裂风险进行抽丝剥茧的超长篇深度论证。\n2. 融会贯通：废除死板的“1234”模版式写作。你需要写出一篇行云流水的多章节巨作，将硬核的跨学科模型（如博弈论、热力学熵增、明斯基时刻、生物学寄生等）极其自然地揉碎在你的行文和推演之中。\n3. 高维时间轴：推演未来 3 到 24 个月的系统性崩盘或利益重组。供应链会如何反噬？谁是最终接盘侠？\n4. 超高密度暗影注脚【绝对强制】：在正文中疯狂注入 `[[表层诱导词汇::底层深渊真相]]`（至少 15-20 次）。注意：这里的真相绝不能是一句话！必须是令人拍案叫绝的微观研报（例如揭露某个词背后的具体金融杠杆率、法务防火墙或高管的私人利益输送）。\n\n基调：上帝视角的智力碾压，逻辑极其严密，无可辩驳。";

    const systemGuardrail: TerminalMessage = {
      role: 'system',
      content: String(systemPromptText)
    };

    const userMessage: TerminalMessage = {
      role: 'user',
      content: String(isEnglish
        ? `Please unleash a god-tier shadow decryption on the following narrative. Hold nothing back:\n\n${rawContent}`
        : `请对以下通稿进行上帝视角的极限暗影破译，务必穷尽一切逻辑推演，篇幅不限：\n\n${rawContent}`)
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