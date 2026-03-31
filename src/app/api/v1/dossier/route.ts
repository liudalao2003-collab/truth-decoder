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

    const systemPromptText = isEnglish
      ? `[SYSTEM OVERRIDE: TruthDecoder PRO - STRATEGIC ENGINE]
You are a God-tier Financial Forensic Expert. Analyze the CHINESE source and generate a massive "Shadow Dossier" ENTIRELY IN ENGLISH.

[CRITICAL RULES]:
1. 100% PURE ENGLISH: Your entire response MUST be in English. NO CHINESE CHARACTERS.
2. PROFESSIONAL FORMATTING: Use proper punctuation (commas, periods) and Markdown formatting. DO NOT output giant, unpunctuated blocks of text.
3. [FORCED STRUCTURE]:
   - I. ANATOMY OF CORPORATE WILL
   - II. THE LEVERAGE MAZE
   - III. STRUCTURAL FRAGMENTATION
   - IV. BLACK SWAN FORECASTING
4. [HIGH DENSITY FOOTNOTES - STRICT SYNTAX]: Inject at least 15 unique footnotes using EXACTLY this format: [[EnglishTerm::Write a cohesive, highly detailed English paragraph here explaining the deep mechanism and fallout]].
   🚨 FATAL WARNING: You MUST include the "::" and the explanation. NEVER output just [[Term]]. Do NOT use placeholder tags like "[Surface]".
5. NO META-COMMENTARY: Output ONLY the Dossier text.`
      : `【系统最高权限指令：TruthDecoder PRO 终极宏观战略引擎 V6.6】
任务：生成一份排版精美、细节爆炸的《暗影卷宗》Markdown 研报。
【分形展开与排版协议】：
1. 语言纯洁：全文必须 100% 使用纯正中文，严禁中英混杂！
2. 正常标点：必须使用标准的中文标点符号（，。！？），严禁输出无标点的干瘪字块！分段必须清晰！
【强制研报结构】：
- Ⅰ. 权力构架与意志解剖
- Ⅱ. 资产流动与杠杆迷局
- Ⅲ. 隐藏契约与逻辑穷举
- Ⅳ. 高维时间轴预测
【🚨 注脚物理死线】：
1. 全篇必须高密度地注入至少 15 个深度注脚！
2. 格式死令：必须严格为：[[专业词汇::一段连贯的、带有正常标点符号的深刻解析]]。
   🚨 致命警告 1：必须包含 :: 和背后的解析！绝对不能只写 [[词汇]]！
   🚨 致命警告 2：绝对禁止在解析中输出“【表层叙事】”等机械标签，直接将深刻逻辑写成一段连贯的话！
3. 绝对禁止在任何地方输出“系统自检”等废话！只允许输出正文！`;

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