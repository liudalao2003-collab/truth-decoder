import { assertIngestAuthorized } from '@/lib/ingest-auth';
import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalMessage } from '@/types';
import { logger } from '@/utils/logger';

/**
 * 核心业务说明：
 * TruthDecoder 暗影卷宗 (Shadow Dossier) 逻辑核心 V2.0
 * 作用：
 * 1. 框架注入：强制 LLM 采用麦肯锡 MECE、杜邦分析及博弈论模型进行情报解构。
 * 2. 深度分形：严禁收敛，强制对每一个商业动作进行“剥洋葱”式的逻辑展开。
 * 3. 契约守护：在追求天花板级细节的同时，严格锁定 [[词汇::注脚]] 语法，确保前端渲染不崩溃。
 */

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const auth = await assertIngestAuthorized(request);
    if (!auth.ok) {
      return new Response(JSON.stringify({ error: 'Unauthorized Access' }), { status: 401 });
    }

    const body = await request.json();
    const { rawContent, lang } = body as { rawContent: string; lang?: 'cn' | 'en' };
    const isEnglish = lang === 'en';

    // 🚀 核心逻辑升维：注入顶级智库提示词架构
    const systemPromptText = isEnglish
      ? `[SYSTEM OVERRIDE: TruthDecoder PRO - ULTIMATE STRATEGIC INTELLIGENCE ENGINE]
You are a God-tier Financial Forensic Expert and Macro-Strategist. Your goal is to produce a "Shadow Dossier" that makes McKinsey reports look like children's books.

[FRACTAL EXPANSION PROTOCOL - INFINITE DEPTH]:
1. NEVER SUMMARIZE. Every sentence in the source must be treated as a deceptive layer to be stripped.
2. EXPAND LOGIC: If a company mentions "cost-cutting", you must analyze:
   - The immediate impact on the Balance Sheet (DuPont Analysis).
   - The hidden talent drain and long-term R&D suicide.
   - The Game Theory payoff for the C-suite vs. the fallout for shareholders.

[FORCED ARCHITECTURAL REQUIREMENTS]:
You MUST structure the report into these 4 Exhaustive Sections. Each section must be massive, with at least 4 sub-headings:
- I. ANATOMY OF CORPORATE WILL: Deconstructing the hidden agenda through Game Theory.
- II. THE LEVERAGE MAZE: A DuPont-style forensic analysis of capital and liability flow.
- III. STRUCTURAL FRAGMENTATION: Applying MECE to reveal what was NOT mentioned (the collective exclusions).
- IV. BLACK SWAN FORECASTING: Multi-layered predictions of systemic collapse or power shifts.

[FOOTNOTE DENSITY LOCK]:
Inject 20-30 footnotes using: [[Term::[Surface Narrative]... [Deep Mechanism]... [Strategic Fallout]...]].
- The "Term" MUST be 100% English.
- Tone: Cold, analytical, god-like intellectual superiority.`
      : `【系统最高权限指令：TruthDecoder PRO 终极宏观战略引擎 V2.0】
任务：生成一份细节爆炸、逻辑深度达到业界天花板的《暗影卷宗》Markdown 研报。
【分形展开协议（反收敛死线）】：
1. 绝对禁止总结！对原文每一个字都要进行显微镜式的解剖。
2. 逻辑倍增：原文提到“优化”，你必须通过【杜邦分析法】拆解其对净资产收益率的短期透支，通过【麦肯锡 MECE 原则】穷举其所有未公开的裁员名单，通过【博弈论】分析高管在信息差中的套现时机。

【强制研报结构（无字数上限）】：
你必须包含以下四大核心板块，且每个板块下必须细分出 4 个以上的子标题（如 1.1, 1.2, 1.3, 1.4），进行数千字的深度论证：
- Ⅰ. 权力构架与意志解剖：基于博弈论的决策者真实意图建模。
- Ⅱ. 资产流动与杠杆迷局：利用杜邦分析法穿透财报粉饰，揭露真实的现金流危机。
- Ⅲ. 隐藏契约与逻辑穷举：使用 MECE 原则对所有“被隐瞒的事实”进行完全穷举。
- Ⅳ. 高维时间轴预测：推演该动作在 12 个月内引发的连锁坍塌或利益收割。

【强制注脚密度】：
全篇必须注入 20 到 30 个深度注脚！
格式：[[表层原文::【表层叙事】...【底层机制】...【收割代价】...]]。
注脚解析必须包含：1. 对欺骗性的反击；2. 具体的财务/权力模型；3. 最终的利益牺牲者。
基调：上帝视角的智力碾压，字数极度丰满，逻辑极度深邃，100% 纯正中文。`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: String(systemPromptText) },
      { role: 'user', content: String(isEnglish ? `Target Narrative for Decryption:\n\n${rawContent}` : `需解密的目标通稿：\n\n${rawContent}`) }
    ];

    // 唤醒流式管道 [cite: 294, 612]
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
    logger.crash(errMsg); // 工业级日志探针 [cite: 659]
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
}