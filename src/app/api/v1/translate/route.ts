import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalMessage } from '@/types';
import { logger } from '@/utils/logger';

export const runtime = 'edge';

interface TranslateRequest {
  content: string;
  targetLang: 'cn' | 'en';
}

export async function POST(req: Request) {
  try {
    logger.start('唤醒暗影卷宗双轨流式翻译引擎');

    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) {
      logger.crash('流式翻译网关越权访问被拦截');
      return new Response(JSON.stringify({ error: 'Unauthorized: Clearance Level Too Low' }), { status: 401 });
    }

    const body = await req.json();
    const { content, targetLang } = body as TranslateRequest;

    if (!content || !targetLang) {
      return new Response(JSON.stringify({ error: 'Missing content or targetLang' }), { status: 400 });
    }

    // 🚨 语言纯洁性最高指令：彻底封杀中英夹杂，强制纯血输出
    const systemPromptText = targetLang === 'en'
      ? `You are a top-tier financial translator. Translate the following "Shadow Dossier" into native, professional English.
[CRITICAL DIRECTIVE]: The text contains highly sensitive interactive anchors formatted EXACTLY as [[Surface Buzzword::Deep Insight]].
1. You MUST absolutely preserve the double brackets '[[' and ']]' and the double colons '::'.
2. [LANGUAGE PURITY]: Translate EVERYTHING into PURE, NATIVE ENGLISH. ABSOLUTELY NO Chinese characters allowed in your output. DO NOT leave original Chinese terms in parentheses.
3. Ensure the translated "Surface Buzzword" makes grammatical sense within the translated surrounding sentence.
4. Output ONLY the translated Markdown text.`
      : `你是一名顶级的金融翻译官。请将以下的“暗影卷宗”翻译为极具专业感和穿透力的中文。
【最高指令】：原文中包含极度敏感的交互锚点，格式严格为 [[表层词汇::深度注脚]]。
1. 你必须绝对保留双括号 '[[' 和 ']]' 以及双冒号 '::' 的物理符号边界。
2. 【语言纯洁性】：你必须将所有内容翻译为纯正的中文。绝对禁止中英夹杂！绝对禁止在译文中用括号保留英文原词（除全球通用的企业缩写外）。
3. 确保翻译后的“表层词汇”在中文语境和句子中读起来通顺自然。
4. 严禁输出 JSON！只输出翻译后的 Markdown 纯文本。`;

    const messages: TerminalMessage[] = [
      { role: 'system', content: String(systemPromptText) },
      { role: 'user', content: String(content) }
    ];

    logger.async(`调度底层 DeepSeek 引擎执行流式翻译 (Target: ${targetLang})`);
    
    // 🔪 核心破壁：强制建立 SSE 流式连接，规避 Vercel 25s 死亡倒计时
    const streamResponse = await createDeepSeekStream(messages);

    logger.success('翻译流式管道已连接，开始向客户端泵入字节流');

    return new Response(streamResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '流式翻译网关级联失效';
    logger.crash(errMsg);
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
}