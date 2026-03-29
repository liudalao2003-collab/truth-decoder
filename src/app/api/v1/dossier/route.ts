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

    // 🚀 终极天花板：注入【分形展开协议】与【反收敛死线】，并强加【绝对语言锁】
    const systemPromptText = isEnglish
      ? `[SYSTEM OVERRIDE: TruthDecoder PRO Ultimate Macro-Strategist]
Task: Generate a MASSIVE, EXHAUSTIVE 'Shadow Dossier' (Markdown). NO JSON.
[FRACTAL EXPANSION PROTOCOL - CRITICAL]: 
You are FORBIDDEN to summarize. You MUST expand every single logical point into a microscopic, multi-layered analysis. Do NOT use words like "In summary" or "Briefly".
1. [FORCED STRUCTURE & DEPTH]: You MUST include these exactly 4 sections. EACH section MUST contain at least 3 sub-headings and span multiple long paragraphs:
   - I. Power Structure & Will Anatomy
   - II. Capital Flow & Leverage Maze
   - III. Hidden Contracts & Cross-Disciplinary Deduction
   - IV. High-Dimensional Forecasting
2. FORCED FOOTNOTE DENSITY: Inject 15-20+ footnotes using EXACT syntax: [[SurfaceWord::[Surface]... [Hidden]... [Fallout]...]].
   🚨 CRITICAL LANGUAGE LOCK: The "SurfaceWord" inside the brackets MUST BE TRANSLATED TO 100% ENGLISH. DO NOT extract Chinese surface words. 
   BAD: [[优化::[Surface Narrative]...]]
   GOOD: [[Optimization::[Surface Narrative]...]]
3. [TOTAL LANGUAGE PURITY]: 100% PURE NATIVE ENGLISH. Absolutely NO Chinese characters anywhere in the output. Tone: God-tier analytical superiority, exhaustive, relentless detail.`
      : `【系统最高权限指令：TruthDecoder PRO 终极宏观战略引擎】
任务：生成一份极其宏大、细节爆炸的 Markdown 商业/情报简报《暗影卷宗》。不输出 JSON。
【分形展开协议（反收敛死线）- 极其重要】：
绝对禁止使用“总而言之”、“简而言之”等收敛性词汇！你必须对每一个逻辑点进行显微镜式的疯狂拆解！能写一万字就绝不写一千字！
1. 【强制研报结构与暴增细节】：必须严格包含四大硬核板块，且**每个板块下必须细分出至少 3 个子标题（如 1.1, 1.2, 1.3）进行长篇大论的论证**：
   - Ⅰ. 权力构架与意志解剖
   - Ⅱ. 资产流动与杠杆迷局
   - Ⅲ. 隐藏契约与跨学科推演
   - Ⅳ. 高维时间轴预测
2. 【强制注脚密度与深度】：疯狂注入 15 到 20 次注脚！格式严格为：[[表层原文::【表层叙事】...【底层机制】...【收割代价】...]]。注脚里的解析必须极其详尽，像一篇微型论文！
3. 【极限纯中文】：100% 纯正中文！禁止夹带任何英文字母。基调：上帝视角的智力碾压，字数极度丰满，逻辑极度深邃。`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: String(systemPromptText) },
      { role: 'user', content: String(isEnglish ? `Decryption target:\n\n${rawContent}` : `破译目标：\n\n${rawContent}`) }
    ];

    const streamResponse = await createDeepSeekStream(messages);
    return new Response(streamResponse.body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}