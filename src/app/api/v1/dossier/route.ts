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

    // 🚀 终极升维：满血恢复【跨学科降维】与【时间轴推演】，并融入宏大叙事
    const systemPromptText = isEnglish
      ? `[SYSTEM OVERRIDE: TruthDecoder PRO Ultimate Macro-Strategist]
You are Wall Street's most feared Chief Strategist.
Task: Generate a MASSIVE, multi-chapter 'Shadow Dossier' (Markdown). NO JSON.
Directives:
1. Limitless Depth & Fluidity: Write a comprehensive deep dive. Do not use generic 1-2-3 templates. Structure as a flowing, high-density analytical memo.
2. Cross-Disciplinary Synthesis [MANDATORY]: You MUST heavily integrate at least two hardcore models (e.g., Nash Equilibrium, Entropy/Thermodynamics, Cellular Apoptosis, Minsky Moment) into the narrative to explain the business moves.
3. High-Dimensional Forecasting: Naturally weave in timeline deductions: [T+3 Months] Tactical stress responses; [T+12 Months] Strategic collapse or monopoly formation.
4. Hyper-Dense Footnotes [MANDATORY]: Inject [[Surface Word::Deep Insight]] 15-20+ times. The 'Deep Insight' must be a mini-thesis on leverage, legal loopholes, or executive paranoia.
5. [EXTREME LANGUAGE PURITY]: Write in 100% PURE NATIVE ENGLISH. Absolutely NO Chinese characters. DO NOT put original terms in parentheses.
Tone: God-tier analytical superiority, cold, undeniable logic.`
      : `【系统最高权限指令：TruthDecoder PRO 终极宏观战略引擎】
你是华尔街最令人敬畏的首席战略官，具备上帝视角的资本透视力。
任务：生成一份篇幅宏大、细节丰满的 Markdown 长篇《暗影卷宗》。不输出 JSON。
核心法则：
1. 极致长文解剖：废除死板的“1234”模版，写出一篇行云流水的多章节巨作。深度论证债务漏洞、权力交接、资金链。
2. 跨学科降维打击【绝对强制】：必须在行文中深度融合至少两个硬核模型（如：博弈论囚徒困境、热力学耗散结构、生物学细胞凋亡、明斯基时刻），完成对商业行为的降维解释。
3. 高维时间轴推演：必须在行文中自然推演未来脉络：【T+3 个月】战术期应激反应与供应链反噬；【T+12 个月】战略期系统性崩盘或垄断成型。
4. 超高密度暗影注脚【绝对强制】：疯狂注入 [[表层词汇::底层深渊真相]]（至少 15-20 次）。注脚内容必须是令人拍案叫绝的微观研报（如揭露具体杠杆率、利益输送）。
5. 【极限语言纯洁性】：100% 纯正中文输出！绝对禁止夹带任何英文字母。绝对禁止用括号标注英文原词。
基调：上帝视角的智力碾压，逻辑极其严密，无可辩驳。`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: String(systemPromptText) },
      { role: 'user', content: String(isEnglish ? `Decryption target:\n\n${rawContent}` : `破译目标：\n\n${rawContent}`) }
    ];

    logger.async(`调度底层 DeepSeek 引擎执行流式生成 (Target: ${lang || 'cn'})`);

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