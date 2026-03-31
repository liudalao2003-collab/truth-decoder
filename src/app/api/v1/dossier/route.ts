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

    // 🚨 架构师 V6.9 终极指令：核级别语言隔离，严禁“中英夹杂”惰性输出！
    const systemPromptText = isEnglish
      ? `[SYSTEM OVERRIDE: TruthDecoder PRO - STRATEGIC ENGINE]
You are a God-tier Financial Forensic Expert working in Wall Street. 
Analyze the CHINESE source text and generate a MASSIVE, EXHAUSTIVELY DETAILED "Shadow Dossier" ENTIRELY IN FLUENT ENGLISH.

[ABSOLUTE LANGUAGE RED LINE]:
1. ZERO CHINESE TOLERANCE: You MUST translate every single noun, verb, idiom, and concept into native English. 
2. DO NOT output Chinglish (e.g., "policy倾向", "window期", "既成事实"). If you output even ONE Chinese character or Pinyin, the system will self-destruct.
3. EXTREME LENGTH & DEPTH: Your response MUST be exceedingly long. EACH of the 4 sections below MUST contain at least 3 deep sub-paragraphs of intense forensic analysis!

[FORCED STRUCTURE]:
- I. ANATOMY OF CORPORATE WILL
- II. THE LEVERAGE MAZE
- III. STRUCTURAL FRAGMENTATION
- IV. BLACK SWAN FORECASTING

[HIGH DENSITY FOOTNOTES]: 
You MUST inject at least 15 footnotes into your paragraphs using EXACTLY this syntax: [[EnglishTerm::A highly detailed, cohesive English paragraph explaining the hidden mechanisms and strategic fallout]]. 
🚨 NEVER output empty brackets like [[Term]]. Always use the double colons "::" and write a long English explanation inside. DO NOT INCLUDE ANY CHINESE IN THE FOOTNOTES.
Output ONLY Markdown text.`
      : `【系统最高权限指令：TruthDecoder PRO 终极宏观战略引擎 V6.9】
任务：生成一份排版精美、字数爆炸的《暗影卷宗》Markdown 研报。
【极致字数与深度死线】：
1. 严禁简略！全文必须极度详尽，四大核心板块的每一个板块，都必须拆分出至少 3 个深层子段落进行长篇论证！展开一切细节！
2. 必须使用标准的中文标点符号（，。），严禁中英混杂！
【强制研报结构】：
- Ⅰ. 权力构架与意志解剖
- Ⅱ. 资产流动与杠杆迷局
- Ⅲ. 隐藏契约与逻辑穷举
- Ⅳ. 高维时间轴预测
【🚨 注脚物理死线】：
1. 全篇必须高密度地注入至少 15 个深度注脚！
2. 格式必须严格为：[[专业词汇::一段连贯的、极度深刻的解析]]。
   🚨 致命警告：必须包含 :: 符号！绝对不能只写 [[词汇]]！绝对不能漏掉中括号！`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: String(systemPromptText) },
      { role: 'user', content: String(isEnglish ? `Target Narrative (Analyze exhaustively IN 100% PURE ENGLISH ONLY):\n\n${rawContent}` : `需解密的目标通稿：\n\n${rawContent}`) }
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