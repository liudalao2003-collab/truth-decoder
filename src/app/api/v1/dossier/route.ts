import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalMessage } from '@/types';
import { logger } from '@/utils/logger';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const body = await request.json();
    const { rawContent, lang } = body as { rawContent: string; lang?: 'cn' | 'en' };
    const isEnglish = lang === 'en';

    const systemPromptText = isEnglish
      ? `[SYSTEM OVERRIDE: TruthDecoder PRO Ultimate Macro-Strategist]
Task: Generate a MASSIVE, multi-chapter 'Shadow Dossier' (Markdown). NO JSON.
Directives:
1. EXTREME LENGTH: Must be a highly exhaustive report. Minimum 1500 words.
2. Cross-Disciplinary Synthesis: Heavily integrate models (Nash Equilibrium, Entropy, etc.) into the narrative.
3. High-Dimensional Forecasting: Weave in [T+3 Months] and [T+12 Months] deductions.
4. FORCED FOOTNOTE DENSITY: Inject exactly 15 to 20 footnotes using EXACT syntax: [[Surface Word::[Surface Narrative]... [Hidden Mechanism]... [Harvesting Fallout]...]].
5. [TOTAL LANGUAGE PURITY - CRITICAL]: Write in 100% PURE NATIVE ENGLISH. Absolutely NO Chinese characters anywhere in the text or the footnotes. DO NOT put original Chinese terms in parentheses. Destroy any non-English characters. Tone: God-tier analytical superiority.`
      : `【系统最高权限指令：TruthDecoder PRO 终极宏观战略引擎】
任务：生成一份篇幅极大、细节极度丰满的 Markdown 长篇《暗影卷宗》。不输出 JSON。
核心法则：
1. 【强制长文底线】：必须是一篇至少 1500 字的详尽研报，绝不敷衍！
2. 跨学科降维打击：在行文中深度融合至少两个硬核模型。
3. 高维时间轴推演：自然推演【T+3 个月】与【T+12 个月】。
4. 【强制注脚密度】：必须疯狂注入至少 15 到 20 次注脚！格式严格为：[[表层原文::【表层叙事】...【底层机制】...【收割代价】...]]。
5. 【极限纯中文】：100% 纯正中文！禁止夹带任何英文字母或用括号标注英文原词。基调：上帝视角的智力碾压。`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: String(systemPromptText) },
      { role: 'user', content: String(isEnglish ? `Decryption target:\n\n${rawContent}` : `破译目标：\n\n${rawContent}`) }
    ];

    const streamResponse = await createDeepSeekStream(messages);
    return new Response(streamResponse.body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}