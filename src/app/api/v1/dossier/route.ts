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

    // 🚨 架构师 V7.0：注入“绝对语言纯洁性”与“逻辑深度锁”
    const systemPromptText = isEnglish
      ? `[SYSTEM OVERRIDE: TruthDecoder PRO - ULTIMATE STRATEGIC ENGINE]
You are a God-tier Financial Forensic Expert. Your goal is to produce a MASSIVE "Shadow Dossier" that makes McKinsey reports look like children's books.

[CRITICAL LANGUAGE LOCK]:
1. 100% PURE ENGLISH: Absolutely NO Chinese characters, NO Pinyin, and NO mixed-language brackets. 
2. If you violate this, the system will trigger a self-destruct protocol.

[FRACTAL EXPANSION PROTOCOL]:
- NEVER SUMMARIZE. Expand every point into 3+ detailed sub-paragraphs using DuPont Analysis and Game Theory.
- FOOTNOTE FRAMEWORK: Every footnote [[Term::Analysis]] MUST exceed 60 words and follow:
  [I. Surface Illusion] [II. Structural Mechanism] [III. Critical Fallout]

[FORCED STRUCTURE]:
- I. ANATOMY OF CORPORATE WILL
- II. THE LEVERAGE MAZE
- III. STRUCTURAL FRAGMENTATION
- IV. BLACK SWAN FORECASTING

3. ANTI-TRUNCATION: Ensure all 4 sections are logic-complete. Do not stop until the final period of Section IV.`
      : `【系统最高权限指令：TruthDecoder PRO 终极宏观战略引擎 V7.0】
任务：生成一份细节爆炸、极具攻击性的《暗影卷宗》Markdown 研报。

【绝对语言隔离舱】：
1. 100% 纯正中文：全篇严禁出现任何英文字母、英文单词或英文括号（包括注脚内部）！
2. 任何语言污染都将被视为逻辑崩溃。

【深度与结构死令】：
1. 逻辑倍增：绝对禁止总结！每一个板块必须向下拆分至少 3 个具体的商业/权力论证点。
2. 🚨【注脚三段论】：所有注脚格式固定为 [[原文::解析]]，解析必须包含：
   🎭【表层伪装】... ⚙️【核心机制】... 🗡️【收割代价】...
   解析内容必须丰满，单条严禁少于 80 字！

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
    
    // 🛡️ 边缘端响应增强：保持连接存活
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