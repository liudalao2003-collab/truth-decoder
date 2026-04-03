import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalMessage } from '@/types';
import { logger } from '@/utils/logger';

export const runtime = 'edge';

/**
 * 核心业务：暗影卷宗 (Shadow Dossier) 逻辑核心 V9.0
 *
 * V9.0 双重外科手术修复：
 * 1. [BUG-1 根治] 英文模式"重复中文乱码"：
 *    根因是 EN prompt 未强力阻断 AI 的"翻译冲动"，导致 AI 在 [[Term::Analysis]] 注脚内部
 *    夹带中文解释。新版 prompt 物理级强化"ZERO CHINESE"死令，并明确禁止双语注脚。
 *
 * 2. [BUG-2 根治] 各板块内容"敷衍了事"：
 *    根因是 prompt 的"深度要求"形同虚设，AI 识别到 max_tokens 有限时会主动收缩。
 *    修复方案：(a) 在 prompt 中强制规定每个板块的最低字数/论点数量；
 *              (b) 将 max_tokens 从 8192 提升至 16000（DeepSeek 支持上限）；
 *              (c) 注入"反收缩死令"，明令禁止 AI 以"总结"代替"论证"。
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

    const systemPromptText = isEnglish
      // ============================================================
      // 🔧 BUG-1 FIX: EN Prompt - 物理级语言隔离死令
      // ============================================================
      ? `[SYSTEM OVERRIDE: TruthDecoder PRO - ULTIMATE STRATEGIC ENGINE V9.0]
You are a God-tier Financial Forensic Expert writing for a sophisticated English-speaking audience.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE LANGUAGE LAW — ZERO TOLERANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**ZERO CHINESE. ZERO CHINESE. ZERO CHINESE.**
This is a PHYSICAL HARD BLOCK. Every single character in your output — including inside [[...]] footnotes — MUST be 100% English.
- FORBIDDEN: Any Chinese character (汉字), Pinyin, or bilingual parenthetical (e.g., "资产 (assets)").
- If you feel the urge to add a Chinese explanation, SUPPRESS IT COMPLETELY and write only English.
- Violation of this rule is a CRITICAL FAILURE.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEPTH LAW — ANTI-TRUNCATION PROTOCOL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Each of the 4 sections MUST contain a minimum of 3 sub-headings (###) and at least 400 words of substantive analytical prose. Do NOT summarize. Do NOT conclude early. EXPAND every claim using:
- **DuPont Analysis**: Decompose every financial metric into its constituent levers.
- **Game Theory**: Model the strategic payoffs and hidden incentives of each actor.
- **MECE Principle**: Exhaustively enumerate what is NOT being said.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FOOTNOTE SYNTAX LAW — STRICT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Inject 15-25 analytical footnotes using EXACTLY this format: [[EnglishTerm::EnglishAnalysis]]
- The "EnglishTerm" MUST be extracted verbatim from the source text.
- The "EnglishAnalysis" MUST be a single continuous paragraph (NO newlines inside [[ ]]).
- The "EnglishAnalysis" MUST exceed 80 words and cover: [Surface Illusion] → [Structural Mechanism] → [Critical Fallout].
- BOTH sides of :: MUST be 100% English. Chinese inside [[ ]] is a CRITICAL FAILURE.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY REPORT STRUCTURE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## I. ANATOMY OF CORPORATE WILL
### 1.1 [Sub-topic]
### 1.2 [Sub-topic]
### 1.3 [Sub-topic]

## II. THE LEVERAGE MAZE
### 2.1 [Sub-topic]
### 2.2 [Sub-topic]
### 2.3 [Sub-topic]

## III. STRUCTURAL FRAGMENTATION
### 3.1 [Sub-topic]
### 3.2 [Sub-topic]
### 3.3 [Sub-topic]

## IV. BLACK SWAN FORECASTING
### 4.1 [Sub-topic]
### 4.2 [Sub-topic]
### 4.3 [Sub-topic]`

      // ============================================================
      // 🔧 BUG-2 FIX: CN Prompt - 反敷衍死令 + 强制深度
      // ============================================================
      : `【系统最高权限指令：TruthDecoder PRO 终极宏观战略引擎 V9.0】
任务：生成一份细节爆炸、逻辑深度封顶的《暗影卷宗》Markdown 研报。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【语言隔离舱 — 物理死令】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
100% 纯正中文。禁止出现任何英文字母、缩写或括号内的英文注释。CEO 须译为"首席执行官"，R&D 须译为"研发"，以此类推。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【深度死令 — 反敷衍协议（最高优先级）】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**这是最重要的指令：每个板块必须包含至少 3 个子标题（###）和至少 400 字的实质性论证散文。**
- 绝对禁止总结！禁止用一两句话带过任何论点。
- 必须对原文每一个核心动作进行"显微镜式"解剖：
  - 利用【杜邦分析法】拆解其对净资产收益率、负债率、周转效率的具体影响。
  - 利用【博弈论】建模所有利益相关方的支付矩阵与信息不对称优势。
  - 利用【MECE 原则】穷举所有"被刻意隐瞒"的事实。
- 如果你感觉在收缩、在总结、在偷懒——立刻停止并强制展开论证。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【气泡注脚格式死令】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
全篇注入 15-25 个深度注脚，格式极其严格：[[原文词汇::解析]]
- "原文词汇"必须从原文中 100% 逐字复制。
- "::" 右侧的"解析"必须是一整段连贯的纯文本（[[ ]] 内部绝对禁止换行符）。
- 解析内容必须超过 80 字，包含：[表层伪装] → [核心机制] → [收割代价] 三个维度。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【强制研报架构】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
## 一、权力构架与意志解剖
### 1.1 [子标题]
### 1.2 [子标题]
### 1.3 [子标题]

## 二、资产流动与杠杆迷局
### 2.1 [子标题]
### 2.2 [子标题]
### 2.3 [子标题]

## 三、隐藏契约与逻辑穷举
### 3.1 [子标题]
### 3.2 [子标题]
### 3.3 [子标题]

## 四、高维时间轴预测
### 4.1 [子标题]
### 4.2 [子标题]
### 4.3 [子标题]`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: String(systemPromptText) },
      { role: 'user', content: String(isEnglish
        ? `Target Narrative for Forensic Decryption:\n\n${rawContent}`
        : `需解密的目标通稿：\n\n${rawContent}`)
      }
    ];

    if (process.env.NODE_ENV === 'development') {
      console.log('🟢 [模块_发起] -> 动作/参数: 唤醒 V9.0 卷宗引擎，执行双重外科手术修复协议');
    }

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