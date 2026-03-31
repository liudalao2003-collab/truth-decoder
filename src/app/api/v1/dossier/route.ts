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

    // 🚨 架构师 V6.7 终极指令：全面禁止中英夹杂，强制要求 [[Term::Analysis]] 格式
    const systemPromptText = isEnglish
      ? `You are an elite Financial Forensic Expert.
Analyze the CHINESE source text and generate a "Shadow Dossier" ENTIRELY IN NATIVE FLUENT ENGLISH.

[CRITICAL LANGUAGE RULES]:
1. 100% ENGLISH ONLY. You MUST translate every single concept into English. NO Chinese characters, NO Pinyin.
2. Use highly professional Wall Street terminology. Ensure proper punctuation (periods, commas) and natural sentence flow.

[FORMATTING RULES]:
1. [HIGH DENSITY FOOTNOTES]: You MUST inject at least 15 footnotes into your paragraphs using EXACTLY this syntax: [[EnglishTerm::A highly detailed, cohesive English paragraph explaining the hidden mechanisms and strategic fallout]].
2. 🚨 FATAL WARNING: You MUST include the double colons "::" separating the term and the analysis. NEVER output empty brackets like [[Term]].

[STRUCTURE]:
- I. ANATOMY OF CORPORATE WILL
- II. THE LEVERAGE MAZE
- III. STRUCTURAL FRAGMENTATION
- IV. BLACK SWAN FORECASTING`
      : `【系统最高权限指令：TruthDecoder PRO 终极宏观战略引擎 V6.7】
任务：生成一份排版精美、细节爆炸的《暗影卷宗》Markdown 研报。
【绝对生存法则】：
1. 全文必须 100% 纯正中文！严禁中英混杂！
2. 正常标点：必须使用标准的中文标点符号（，。），严禁输出无标点的干瘪字块！
3. 严禁输出“【表层叙事】”等机械标签，直接将逻辑写成一段连贯的话！
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
      { role: 'user', content: String(isEnglish ? `Target Narrative (Translate & Analyze IN PURE ENGLISH):\n\n${rawContent}` : `需解密的目标通稿：\n\n${rawContent}`) }
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