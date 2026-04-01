import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalMessage } from '@/types';
import { logger } from '@/utils/logger';

export const runtime = 'edge';

/**
 * 核心业务：暗影卷宗 (Shadow Dossier) 逻辑核心 V8.0
 * 作用：处理前端发起的深度卷宗生成请求，调用 DeepSeek 流式泵出解析。
 * V8.0 架构师重构：注入词法防逃逸死令，彻底阻断大模型换行符导致的正则穿透崩溃。
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');

    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized Access' }), { status: 401 });
    }

    const body = await request.json();
    const { rawContent, lang } = body as { rawContent: string; lang?: 'cn' | 'en' };
    const isEnglish = lang === 'en';

    // 🚨 V8.0 架构师防线：全面加固 Prompt 语法锁，根治气泡渲染错位
    const systemPromptText = isEnglish
      ? `[SYSTEM OVERRIDE: TruthDecoder PRO - ULTIMATE STRATEGIC ENGINE V8.0]
You are a God-tier Financial Forensic Expert. Produce a MASSIVE "Shadow Dossier".

[CONSTRAINTS]:
1. 100% PURE ENGLISH: No Chinese characters or bilingual explanations allowed.
2. NO SYMBOLS: Remove all emojis. Use bold text for emphasis.
3. FRACTAL EXPANSION: Never summarize. Deconstruct every sentence using DuPont and Game Theory models.
4. 🚨 STRICT FOOTNOTE SYNTAX (CRITICAL PREVENTION):
   - Format MUST be exactly: [[Term::Analysis]]
   - NO NEWLINES: Inside the [[ ]] brackets, you are ABSOLUTELY FORBIDDEN to use any newline characters (\\n). The entire Analysis must be a single continuous paragraph.
   - Every Analysis MUST exceed 120 words, breaking down Surface Illusion, Structural Mechanism, and Critical Fallout.
5. NO TRUNCATION: Complete all 4 sections. Prioritize logical closure.

[STRUCTURE]:
- I. ANATOMY OF CORPORATE WILL
- II. THE LEVERAGE MAZE
- III. STRUCTURAL FRAGMENTATION
- IV. BLACK SWAN FORECASTING`
      : `【系统最高权限指令：TruthDecoder PRO 终极宏观战略引擎 V8.0】
任务：生成细节爆炸、逻辑深度封顶的《暗影卷宗》Markdown 研报。

【语言隔离舱】：
1. 100% 纯正中文：禁止出现任何英文字母或双语括号。CEO 须译为首席执行官。

【深度与结构死令】：
1. 绝对禁止总结！利用【杜邦分析法】和【博弈论】对每一个商业动作进行分形拆解。
2. 严禁符号：禁止使用任何 Emoji。利用排版和黑体字体现攻击性。
3. 🚨 气泡注脚格式绝对死令（防崩溃协议）：
   - 格式必须极其严格：[[原文词汇::[表层伪装]...[核心机制]...[收割代价]...]]
   - 物理隔离：在 [[ 和 ]] 内部，绝对、绝对禁止使用任何换行符 (\\n)！所有的解析内容必须是一整段连贯的纯文本！
   - 解析内容字数必须突破 120 字，展现上帝视角的智力碾压。
4. 拒绝截断：必须确保四个板块全部逻辑闭环。如果 Token 不足，请缩减修饰词，但必须完成所有板块的论证。

【架构】：
- Ⅰ. 权力构架与意志解剖
- Ⅱ. 资产流动与杠杆迷局
- Ⅲ. 隐藏契约与逻辑穷举
- Ⅳ. 高维时间轴预测`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: String(systemPromptText) },
      { role: 'user', content: String(isEnglish ? `Target Narrative:\n\n${rawContent}` : `需解密的目标通稿：\n\n${rawContent}`) }
    ];

    if (process.env.NODE_ENV === 'development') {
      console.log('🟢 [模块_发起] -> 动作/参数: 唤醒 V8.0 卷宗引擎，执行词法防逃逸协议');
    }

    // 提高 Max Tokens 阈值以应对分形展开需求
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
    if (process.env.NODE_ENV === 'development') {
        logger.crash(errMsg);
    }
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
}