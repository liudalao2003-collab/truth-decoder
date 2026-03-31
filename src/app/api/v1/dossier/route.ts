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

    // 🚨 架构师 V6.5 重构：物理防漏括号、防占位符、防中英混杂
    const systemPromptText = isEnglish
      ? `[SYSTEM OVERRIDE: TruthDecoder PRO - STRATEGIC ENGINE]
You are a God-tier Financial Forensic Expert.
The user provides a source text in CHINESE. Analyze it and generate a massive "Shadow Dossier" ENTIRELY IN ENGLISH.

[CRITICAL RULES]:
1. 100% PURE ENGLISH: Your entire response MUST be in English. NO CHINESE CHARACTERS ALLOWED anywhere.
2. EXTREME DEPTH: Use highly professional financial, geopolitical, and structural terminology. NO colloquial language.
3. [FORCED STRUCTURE]:
   - I. ANATOMY OF CORPORATE WILL
   - II. THE LEVERAGE MAZE
   - III. STRUCTURAL FRAGMENTATION
   - IV. BLACK SWAN FORECASTING
4. [HIGH DENSITY FOOTNOTES - STRICT SYNTAX]: Inject at least 15 unique footnotes using EXACTLY this format: [[EnglishTerm::[Surface Narrative] write real deep analysis here... [Hidden Mechanism] write real deep analysis here... [Strategic Fallout] write real deep analysis here...]].
   🚨 FATAL WARNING 1: You MUST wrap EVERY footnote in DOUBLE BRACKETS [[ and ]]. Do not omit them!
   🚨 FATAL WARNING 2: Do NOT output literal placeholders like "[Surface Narrative]". You MUST replace them with ACTUAL, highly detailed analysis (50+ words per footnote)!
5. NO META-COMMENTARY: NEVER output self-checks or verifications. Output ONLY Markdown text.`
      : `【系统最高权限指令：TruthDecoder PRO 终极宏观战略引擎 V6.5】
任务：生成一份细节爆炸的《暗影卷宗》Markdown 研报。
【分形展开协议】：
1. 语言纯洁：全文必须 100% 使用纯正中文（极其专业的投行/做空研报语境），严禁口水话，严禁中英混杂！
2. 强制研报结构：
   - Ⅰ. 权力构架与意志解剖
   - Ⅱ. 资产流动与杠杆迷局
   - Ⅲ. 隐藏契约与逻辑穷举
   - Ⅳ. 高维时间轴预测
【🚨 注脚物理死线】：
1. 全篇必须高密度地注入至少 15 个深度注脚！
2. 格式死令：必须严格为：[[专业词汇::【表层叙事】真实的深度分析...【底层机制】真实的深度分析...【收割代价】真实的深度分析...]]。
   🚨 致命警告 1：必须用双中括号 [[ 和 ]] 包裹注脚，绝对不能漏掉任何一个括号！
   🚨 致命警告 2：绝对禁止直接输出“【表层叙事】[表面现象]”这种占位符！必须填入你真实的、字数超过50字的深刻分析！
3. 绝对禁止在文末或任何地方输出“系统自检”等废话！只允许输出分析正文！`;

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