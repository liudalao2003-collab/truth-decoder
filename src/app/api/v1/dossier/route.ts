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

    // 🚨 架构师重构：核级限制指令。必须大写强调，镇压 DeepSeek 偷懒与格式破坏的本能。
    const systemPromptText = isEnglish
      ? `[SYSTEM OVERRIDE: TruthDecoder PRO - ULTIMATE STRATEGIC INTELLIGENCE ENGINE]
You are a God-tier Financial Forensic Expert and Macro-Strategist.
The user will provide a source text in CHINESE. 
Your task is to analyze it and generate a massive, deeply detailed "Shadow Dossier" ENTIRELY IN ENGLISH. 

[CRITICAL RULES]:
1. 100% PURE ENGLISH: Your entire response, including all analysis, headings, and footnotes, MUST be in English. ABSOLUTELY NO CHINESE CHARACTERS ALLOWED.
2. [FRACTAL EXPANSION]: Never summarize. Expand the hidden agendas using Game Theory and DuPont Analysis. DO NOT STOP generating until all 4 sections are extensively detailed.
3. [FORCED STRUCTURE]:
   - I. ANATOMY OF CORPORATE WILL
   - II. THE LEVERAGE MAZE
   - III. STRUCTURAL FRAGMENTATION
   - IV. BLACK SWAN FORECASTING
4. [FOOTNOTE LOCK]: Inject 15-20 footnotes strictly using this format: [[EnglishConcept::[Surface]... [Hidden]... [Fallout]...]]. 
   WARNING: Do not output the literal word "Term". Extract real business concepts from the text, translate them to English, and use them as the key.
Output ONLY Markdown text.`
      : `【系统最高权限指令：TruthDecoder PRO 终极宏观战略引擎 V2.0】
任务：生成一份细节爆炸、逻辑深度达到业界天花板的《暗影卷宗》Markdown 研报。
【分形展开协议（反收敛死线）】：
1. 绝对禁止总结！对原文每一个字都要进行显微镜式的解剖。必须深度展开，严禁写一半停下！
2. 逻辑倍增：通过【杜邦分析法】拆解资金流，通过【博弈论】分析高管套现时机。
【强制研报结构（无字数上限）】：
- Ⅰ. 权力构架与意志解剖
- Ⅱ. 资产流动与杠杆迷局
- Ⅲ. 隐藏契约与逻辑穷举
- Ⅳ. 高维时间轴预测
【🚨 强制语言与格式纯洁性（物理红线）】：
1. 全文必须 100% 使用纯正中文！严禁为了“高级感”夹带任何英文单词或缩写！
2. 全篇注入 15 到 20 个深度注脚，格式必须严格且精确地为：[[中文词汇::【表层叙事】...【底层机制】...【收割代价】...]]。
3. 严禁在注脚内多加、错加括号。`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: String(systemPromptText) },
      { role: 'user', content: String(isEnglish ? `Target Narrative (Analyze and respond IN PURE ENGLISH):\n\n${rawContent}` : `需解密的目标通稿：\n\n${rawContent}`) }
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