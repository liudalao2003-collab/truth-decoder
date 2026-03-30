import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalMessage } from '@/types';
import { logger } from '@/utils/logger';

/**
 * 核心业务说明：
 * TruthDecoder 暗影卷宗 (Shadow Dossier) 逻辑核心 V2.0
 * 作用：
 * 1. 框架注入：强制 LLM 采用麦肯锡 MECE、杜邦分析及博弈论模型进行情报解构。
 * 2. 深度分形：严禁收敛，强制对每一个商业动作进行“剥洋葱”式的逻辑展开。
 * 3. 契约守护：在追求天花板级细节的同时，严格锁定 [[词汇::注脚]] 语法。
 */

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

    // 🚀 核心逻辑升维：注入顶级智库提示词架构
    const systemPromptText = isEnglish
      ? `[SYSTEM OVERRIDE: TruthDecoder PRO - ULTIMATE STRATEGIC INTELLIGENCE ENGINE]
You are a God-tier Financial Forensic Expert and Macro-Strategist.
[FORCED ARCHITECTURAL REQUIREMENTS]:
- I. ANATOMY OF CORPORATE WILL
- II. THE LEVERAGE MAZE
- III. STRUCTURAL FRAGMENTATION
- IV. BLACK SWAN FORECASTING
Inject 20-30 footnotes using: [[Term::[Surface Narrative]... [Deep Mechanism]... [Strategic Fallout]...]].`
      : `【系统最高权限指令：TruthDecoder PRO 终极宏观战略引擎 V2.0】
任务：生成一份细节爆炸、逻辑深度达到业界天花板的《暗影卷宗》Markdown 研报。
【强制研报结构（无字数上限）】：
- Ⅰ. 权力构架与意志解剖
- Ⅱ. 资产流动与杠杆迷局
- Ⅲ. 隐藏契约与逻辑穷举
- Ⅳ. 高维时间轴预测
【强制注脚密度】：全篇注入 20 到 30 个深度注脚，格式：[[表层原文::【表层叙事】...【底层机制】...【收割代价】...]]。`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: String(systemPromptText) },
      { role: 'user', content: String(isEnglish ? `Target Narrative:\n\n${rawContent}` : `需解密的目标通稿：\n\n${rawContent}`) }
    ];

    const streamResponse = await createDeepSeekStream(messages);
    return new Response(streamResponse.body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });

  } catch (error: unknown) {
    // 🚀 核心修复：通过类型收缩确保 unknown 类型的安全解析 
    const errMsg = error instanceof Error ? error.message : 'Dossier Engine Cascade Failure';
    logger.crash(errMsg); 
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
}