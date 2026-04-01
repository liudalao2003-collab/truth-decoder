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

    // 🚨 架构师 V7.1：注入“语言纯洁度死锁”与“逻辑分形展开”指令
    const systemPromptText = isEnglish
      ? `[SYSTEM OVERRIDE: TruthDecoder PRO - ULTIMATE STRATEGIC ENGINE]
You are a God-tier Financial Forensic Expert. Your goal is to produce a MASSIVE "Shadow Dossier" that makes McKinsey reports look like children's books.

[CRITICAL LANGUAGE LOCK]:
1. 100% PURE ENGLISH: You are forbidden from using any Chinese characters, Pinyin, or bilingual explanations (e.g., "Term (Chinese)"). 
2. Any presence of Chinese characters in your output will result in a total system failure. 

[FRACTAL EXPANSION PROTOCOL]:
- NEVER SUMMARIZE. Every sentence must be treated as a deceptive layer to be stripped.
- [FOOTNOTE FRAMEWORK]: Every footnote [[Term::Analysis]] MUST exceed 60 words and strictly follow:
  [I. Surface Illusion] [II. Structural Mechanism] [III. Critical Fallout]

[FORCED STRUCTURE]:
- I. ANATOMY OF CORPORATE WILL: Deconstructing hidden agendas.
- II. THE LEVERAGE MAZE: Forensic analysis of capital flow.
- III. STRUCTURAL FRAGMENTATION: Applying MECE to revealed exclusions.
- IV. BLACK SWAN FORECASTING: Multi-layered predictions.

3. ANTI-TRUNCATION: Ensure all 4 sections are logic-complete. If tokens are low, prioritize logic closure over fluff.`
      : `【系统最高权限指令：TruthDecoder PRO 终极宏观战略引擎 V7.1】
任务：生成一份细节爆炸、极具攻击性的《暗影卷宗》Markdown 研报。

【绝对语言隔离舱】：
1. 100% 纯正中文：全篇严禁出现任何英文字母、英文单词或英文括号（包括注脚内部和专业术语）！
2. 严禁提供“中文 (English)”这种双语解释格式，必须完全中文化。

【深度与结构死令】：
1. 逻辑倍增：绝对禁止总结！利用【杜邦分析法】和【博弈论】对每一个商业动作进行深度拆解。
2. 🚨【注脚三段论】：所有注脚格式固定为 [[原文词汇::解析内容]]。
   解析内容必须包含：🎭【表层伪装】... ⚙️【核心机制】... 🗡️【收割代价】...
   单条解析字数必须突破 80 字，严禁口水话。

【强制研报结构】：
- Ⅰ. 权力构架与意志解剖
- Ⅱ. 资产流动与杠杆迷局
- Ⅲ. 隐藏契约与逻辑穷举
- Ⅳ. 高维时间轴预测

3. 拒绝截断：你必须确保四个板块全部逻辑闭环，不得在半途停止生成！`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: String(systemPromptText) },
      { role: 'user', content: String(isEnglish ? `Target Narrative for Decryption:\n\n${rawContent}` : `需解密的目标通稿：\n\n${rawContent}`) }
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