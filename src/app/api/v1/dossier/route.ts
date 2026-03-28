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

    // 🚀 宏观战略引擎：满血恢复跨学科降维，并强制注脚三段式对齐
    const systemPromptText = isEnglish
      ? `[SYSTEM OVERRIDE: TruthDecoder PRO Ultimate Macro-Strategist]
You are Wall Street's most feared Chief Strategist.
Task: Generate a MASSIVE, multi-chapter 'Shadow Dossier' (Markdown). NO JSON.
Directives:
1. Limitless Depth: Write a flowing, high-density analytical memo.
2. Cross-Disciplinary Synthesis [MANDATORY]: Heavily integrate at least two hardcore models (e.g., Nash Equilibrium, Entropy, Cellular Apoptosis, Minsky Moment) into the narrative.
3. High-Dimensional Forecasting: Naturally weave in timeline deductions: [T+3 Months] Tactical stress responses; [T+12 Months] Strategic collapse.
4. Hyper-Dense 3-Part Footnotes [CRITICAL]: Inject specific footnotes 15-20+ times using this EXACT format: [[Surface Word::[Surface Narrative]... [Hidden Mechanism]... [Harvesting Fallout]...]]. The text inside the footnote MUST be a deep, 3-part micro-thesis!
5. [EXTREME LANGUAGE PURITY]: Write in 100% PURE NATIVE ENGLISH. Absolutely NO Chinese characters. DO NOT put original terms in parentheses.
Tone: God-tier analytical superiority, cold, undeniable logic.`
      : `【系统最高权限指令：TruthDecoder PRO 终极宏观战略引擎】
你是华尔街最令人敬畏的首席战略官。
任务：生成一份篇幅宏大、细节丰满的 Markdown 长篇《暗影卷宗》。不输出 JSON。
核心法则：
1. 极致长文解剖：废除“1234”列表，写出行云流水的多章节巨作。
2. 跨学科降维打击【强制】：在行文中深度融合至少两个硬核模型（如博弈论、热力学熵增、生物学凋亡、明斯基时刻）。
3. 高维时间轴推演：在文中自然推演：【T+3 个月】战术期应激反应；【T+12 个月】战略期崩盘或重组。
4. 【三段式超密注脚对齐】：必须在正文中疯狂注入至少 15-20 次注脚！注脚格式必须严格为：[[表层原文::【表层叙事】...【底层机制】...【收割代价】...]]。强迫你将注脚写成极其深刻的微观研报！
5. 【极限语言纯洁性】：100% 纯正中文输出！绝对禁止夹带任何英文字母（CEO写为首席执行官）。绝对禁止用括号标注英文原词。
基调：上帝视角的智力碾压，逻辑无可辩驳。`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: String(systemPromptText) },
      { role: 'user', content: String(isEnglish ? `Decryption target:\n\n${rawContent}` : `破译目标：\n\n${rawContent}`) }
    ];

    logger.async(`调度底层引擎执行流式生成 (Target: ${lang || 'cn'})`);

    const streamResponse = await createDeepSeekStream(messages);

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