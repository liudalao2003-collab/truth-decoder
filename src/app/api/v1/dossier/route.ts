import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalMessage } from '@/types';
import { logger } from '@/utils/logger';

export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const body = await request.json();
    const { rawContent, lang } = body as { rawContent: string; lang?: 'cn' | 'en' };
    const isEnglish = lang === 'en';

    // 🚀 核心升维：在长文渲染中注入反括号夹杂防线
    const systemPromptText = isEnglish
      ? "[SYSTEM OVERRIDE: TruthDecoder PRO Ultimate Think Tank]\nYou are the most feared Chief Strategist on Wall Street.\nTask: Generate a MASSIVE, highly detailed 'Shadow Dossier' (Markdown). NO JSON.\nDirectives:\n1. Limitless Depth: Multi-chapter narrative. Integrate cross-disciplinary models naturally.\n2. Hyper-Dense Footnotes: Inject [[Surface Word::Deep Insight]] frequently (15-20+ times).\n3. [EXTREME LANGUAGE PURITY]: Write in 100% PURE NATIVE ENGLISH. Absolutely NO Chinese characters. DO NOT put original Chinese terms in parentheses (e.g., write 'Apple', NOT 'Apple (苹果)')."
      : "【系统最高权限指令：TruthDecoder PRO 终极智库引擎】\n你是华尔街最令人敬畏的首席战略官。\n任务：生成一份篇幅宏大、细节丰满的 Markdown 长篇《暗影卷宗》。不输出 JSON。\n核心法则：\n1. 极致长文解剖：多章节巨作，将硬核跨学科模型自然揉碎在行文之中。\n2. 超高密度暗影注脚：在正文中疯狂注入 [[表层诱导词汇::底层深渊真相]]（至少 15-20 次）。\n3. 【极限语言纯洁性】：100% 纯正中文输出！绝对禁止在正文和注脚中夹带任何英文字母（如 CEO 必须写为首席执行官）。绝对禁止用括号标注英文原词（例如：不允许出现“优化(Optimization)”，只能写“优化”）！";

    const messages: TerminalMessage[] = [
      { role: 'system', content: String(systemPromptText) },
      { role: 'user', content: String(isEnglish ? `Decryption target:\n\n${rawContent}` : `破译目标：\n\n${rawContent}`) }
    ];

    const streamResponse = await createDeepSeekStream(messages);
    return new Response(streamResponse.body, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}