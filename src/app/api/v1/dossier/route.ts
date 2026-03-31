import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalMessage } from '@/types';
import { logger } from '@/utils/logger';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized Access' }), { status: 401 });
    }

    const body = await request.json();
    const { rawContent, lang } = body as { rawContent: string; lang?: 'cn' | 'en' };
    const isEnglish = lang === 'en';

    // 🚨 架构师重构 V6.3：强迫高密度注脚，并警告不得进入死循环
    const systemPromptText = isEnglish
      ? `[SYSTEM OVERRIDE: TruthDecoder PRO - STRATEGIC ENGINE]
You are a God-tier Financial Forensic Expert.
The user provides a source text in CHINESE. Analyze it and generate a massive "Shadow Dossier" ENTIRELY IN ENGLISH.

[CRITICAL RULES]:
1. 100% PURE ENGLISH: Your entire response MUST be in English. NO CHINESE ALLOWED.
2. NO REPETITION: Do NOT repeat the same sentences or phrases endlessly. Generate diverse, insightful analysis.
3. [FORCED STRUCTURE]:
   - I. ANATOMY OF CORPORATE WILL
   - II. THE LEVERAGE MAZE
   - III. STRUCTURAL FRAGMENTATION
   - IV. BLACK SWAN FORECASTING
4. [HIGH DENSITY FOOTNOTES]: You MUST inject at least 15 unique footnotes throughout the text using this EXACT format: [[EnglishConcept::[Surface]... [Hidden]... [Fallout]...]]. 
   Make sure you use different concepts for every footnote.
Output ONLY Markdown text.`
      : `【系统最高权限指令：TruthDecoder PRO 终极宏观战略引擎 V6.3】
任务：生成一份细节爆炸的《暗影卷宗》Markdown 研报。
【分形展开协议（反收敛死线）】：
1. 绝对禁止总结！严禁无意义的复读机循环！
【强制研报结构】：
- Ⅰ. 权力构架与意志解剖
- Ⅱ. 资产流动与杠杆迷局
- Ⅲ. 隐藏契约与逻辑穷举
- Ⅳ. 高维时间轴预测
【🚨 强制注脚密度（物理红线）】：
1. 全文必须 100% 使用纯正中文！
2. 全篇必须高频次、高密度地注入至少 15 个深度注脚！
3. 格式必须严格为：[[中文词汇::【表层叙事】...【底层机制】...【收割代价】...]]。严禁多个注脚使用同一个词汇！`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: String(systemPromptText) },
      { role: 'user', content: String(isEnglish ? `Target Narrative (Analyze IN PURE ENGLISH):\n\n${rawContent}` : `需解密的目标通稿：\n\n${rawContent}`) }
    ];

    const streamResponse = await createDeepSeekStream(messages);
    return new Response(streamResponse.body, {
      headers: { 
        'Content-Type': 'text/event-stream', 
        'Cache-Control': 'no-cache', 
        'Connection': 'keep-alive' 
      },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Dossier Engine Cascade Failure';
    logger.crash(errMsg); 
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
}