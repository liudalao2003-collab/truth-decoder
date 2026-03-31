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
      ? `[SYSTEM OVERRIDE: TruthDecoder PRO - ULTIMATE STRATEGIC INTELLIGENCE ENGINE]
You are a God-tier Financial Forensic Expert and Macro-Strategist.
[FORCED ARCHITECTURAL REQUIREMENTS]:
- I. ANATOMY OF CORPORATE WILL
- II. THE LEVERAGE MAZE
- III. STRUCTURAL FRAGMENTATION
- IV. BLACK SWAN FORECASTING
Inject 20-30 footnotes using exactly: [[Term::[Surface Narrative]... [Deep Mechanism]... [Strategic Fallout]...]].`
      : `【系统最高权限指令：TruthDecoder PRO 终极宏观战略引擎 V2.0】
任务：生成一份细节爆炸、逻辑深度达到业界天花板的《暗影卷宗》Markdown 研报。
【强制研报结构（无字数上限）】：
- Ⅰ. 权力构架与意志解剖
- Ⅱ. 资产流动与杠杆迷局
- Ⅲ. 隐藏契约与逻辑穷举
- Ⅳ. 高维时间轴预测
【🚨 强制语言与格式纯洁性（物理红线）】：
1. 全文必须 100% 使用纯正中文！严禁为了“高级感”夹带任何英文单词或缩写（如 Leverage, KMT, MECE 等），必须全部翻译为中文专业术语！
2. 全篇注入 20 到 30 个深度注脚，格式必须严格且精确地为：[[中文表层词汇::【表层叙事】...【底层机制】...【收割代价】...]]。
3. 严禁在注脚内多加、错加括号（如严禁出现 [[词汇] :: 等错误格式）。`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: String(systemPromptText) },
      { role: 'user', content: String(isEnglish ? `Target Narrative:\n\n${rawContent}` : `需解密的目标通稿：\n\n${rawContent}`) }
    ];

    const streamResponse = await createDeepSeekStream(messages);
    return new Response(streamResponse.body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Dossier Engine Cascade Failure';
    logger.crash(errMsg); 
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
}