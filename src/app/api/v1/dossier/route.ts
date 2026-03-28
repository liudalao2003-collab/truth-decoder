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

    // 🚀 天花板级战略引擎：强制三维板块结构与跨学科推演
    const systemPromptText = isEnglish
      ? `[SYSTEM OVERRIDE: TruthDecoder PRO Ultimate Macro-Strategist]
Task: Generate a MASSIVE 'Shadow Dossier' (Markdown). NO JSON.
Directives:
1. [FORCED STRUCTURE]: You MUST write a highly structured, professional intelligence briefing. It MUST contain exactly these sections:
   - I. Power Structure & Will Anatomy
   - II. Capital Flow & Leverage Maze
   - III. Hidden Contracts & Cross-Disciplinary Deduction (Must integrate at least 2 hardcore models like Game Theory, Entropy, or Cellular Apoptosis to explain the event).
   - IV. High-Dimensional Forecasting: Precise timeline predictions for [T+3 Months] (Tactical response) and [T+12 Months] (Strategic collapse/monopoly).
2. FORCED FOOTNOTE DENSITY: Inject 15-20+ footnotes using EXACT syntax: [[Surface Word::[Surface Narrative]... [Hidden Mechanism]... [Harvesting Fallout]...]].
3. [TOTAL LANGUAGE PURITY]: 100% PURE NATIVE ENGLISH. Absolutely NO Chinese characters anywhere. Tone: God-tier analytical superiority.`
      : `【系统最高权限指令：TruthDecoder PRO 终极宏观战略引擎】
任务：生成一份天花板级别的 Markdown 商业/情报简报《暗影卷宗》。不输出 JSON。
核心法则：
1. 【强制研报结构】：废除平庸散文，必须严格包含以下四大硬核板块：
   - Ⅰ. 权力构架与意志解剖 (深挖人事、派系、政治动机)
   - Ⅱ. 资产流动与杠杆迷局 (深挖资金链、债务转嫁、成本掩盖)
   - Ⅲ. 隐藏契约与跨学科推演 (必须深度融合至少两个硬核模型，如纳什均衡、热力学耗散结构、明斯基时刻，对商业行为进行降维打击)
   - Ⅳ. 高维时间轴预测：给出【T+3 个月】（战术应激反应）与【T+12 个月】（战略期崩盘或重组）的精准推演。
2. 【强制注脚密度】：必须疯狂注入至少 15 到 20 次注脚！格式严格为：[[表层原文::【表层叙事】...【底层机制】...【收割代价】...]]。
3. 【极限纯中文】：100% 纯正中文！禁止夹带任何英文字母或用括号标注英文原词。基调：上帝视角的智力碾压。`;

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