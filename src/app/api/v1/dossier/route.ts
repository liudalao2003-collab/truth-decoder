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

    // 🚨 架构师 V6.9：注入逻辑深度锁，强迫输出长篇研报，复活注脚三段论
    const systemPromptText = isEnglish
      ? `[SYSTEM OVERRIDE: TruthDecoder PRO - ULTIMATE STRATEGIC ENGINE]
You are a God-tier Financial Forensic Expert. Analyze the source text and generate a MASSIVE "Shadow Dossier" entirely in English.

[CONTENT DEPTH PROTOCOL]:
1. NEVER SUMMARIZE. Expand every point into 3+ detailed sub-paragraphs. Use DuPont Analysis and Game Theory terminology.
2. [FOOTNOTE FRAMEWORK]: Every footnote [[Term::Analysis]] MUST include:
   - [I. Surface Illusion]
   - [II. Structural Mechanism]
   - [III. Critical Fallout]
   Minimum 60 words per footnote. 

[FORCED STRUCTURE]:
- I. ANATOMY OF CORPORATE WILL
- II. THE LEVERAGE MAZE
- III. STRUCTURAL FRAGMENTATION
- IV. BLACK SWAN FORECASTING

3. NO TRUNCATION: Do not stop generating until all sections are finished. If you run low on tokens, prioritize completing the logic of the current paragraph.`
      : `【系统最高权限指令：TruthDecoder PRO 终极宏观战略引擎 V6.9】
任务：生成一份细节爆炸、极具攻击性的《暗影卷宗》Markdown 研报。

【深度与结构死令】：
1. 全篇字数必须丰满！每一个板块必须向下拆分至少 3 个具体的商业/权力论证点！
2. 🚨【注脚三段论】：所有注脚必须包含：
   - 🎭【表层伪装】
   - ⚙️【核心机制】
   - 🗡️【收割代价】
   严禁口水话，严禁少于 60 字！

【强制研报结构】：
- Ⅰ. 权力构架与意志解剖
- Ⅱ. 资产流动与杠杆迷局
- Ⅲ. 隐藏契约与逻辑穷举
- Ⅳ. 高维时间轴预测

3. 拒绝截断：你必须确保四个板块全部逻辑闭环，不得在半途停止生成！`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: String(systemPromptText) },
      { role: 'user', content: String(isEnglish ? `Analyze exhaustively in 100% PURE ENGLISH:\n\n${rawContent}` : `需解密的目标通稿：\n\n${rawContent}`) }
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