import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalMessage } from '@/types';
import { logger } from '@/utils/logger';

// 🚀 强制使用 Edge Runtime，避免 Node.js 阻塞，免疫 Vercel 60秒无服务器超时熔断
export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    logger.start('接收到暗影卷宗 (Shadow Dossier) 流式生成请求');

    // 1. 物理级鉴权防线 (复用系统的 INGEST_TOKEN 保护核心资产)
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) {
      logger.crash('暗影卷宗网关 - 越权访问尝试已被拦截');
      return new Response(JSON.stringify({ error: 'Unauthorized: Clearance Level Too Low' }), { status: 401 });
    }

    // 2. 载荷解析与 TS 类型断言 (新增 lang 参数)
    const body = await request.json();
    const { rawContent, lang } = body as { rawContent: string; lang?: 'cn' | 'en' };

    if (!rawContent || typeof rawContent !== 'string') {
      logger.crash('暗影卷宗网关 - 缺少有效的情报文本');
      return new Response(JSON.stringify({ error: '缺少有效的情报文本' }), { status: 400 });
    }

    // 3. 动态注入系统级护栏指令 (根据语种切换)
    const isEnglish = lang === 'en';
    const systemGuardrail: TerminalMessage = {
      role: 'system',
      content: isEnglish
        ? `You are the Chief Shadow Intelligence Officer of TruthDecoder PRO.
Task: Based on the provided commercial press release, generate a coherent, highly penetrating "Shadow Dossier" memo.
Requirements:
1. Must be a coherent deep-dive analysis, not just bullet points.
2. Strip away official PR fluff and directly expose capital movements, power transitions, or covered-up crises.
3. Include at least 3 hard data/facts as support, integrated naturally into the narrative.
4. Tone: Cold, professional, piercing (like an internal memo from a top-tier short-selling firm).
5. NO JSON! Output a well-formatted Markdown article. MUST BE IN NATIVE ENGLISH (NO CHINESE).`
        : `你现在是 TruthDecoder PRO 的首席暗影情报官。
任务：基于用户提供的商业通稿，生成一份连贯的、极具穿透力的【暗影卷宗 (Shadow Dossier)】长文报告。
要求：
1. 必须是一篇连贯的深度分析文章，而非简单的要点罗列。
2. 扒光官方话术的伪装，直接揭露资本动向、权力交接或掩盖的危机。
3. 必须包含至少3条硬核数据/事实作为支撑，并将它们自然地融入叙事中。
4. 语言风格：冷酷、专业、一针见血（类似顶级做空机构的内部备忘录）。
5. 严禁输出 JSON！必须直接输出富含逻辑层次的 Markdown 格式排版长文。`
    };

    const userMessage: TerminalMessage = {
      role: 'user',
      content: isEnglish
        ? `Please conduct a deep shadow decryption of the following narrative:\n\n${rawContent}`
        : `请对以下通稿进行深度暗影破译：\n\n${rawContent}`
    };

    const messages: TerminalMessage[] = [systemGuardrail, userMessage];

    logger.async(`呼叫底层大模型流式引擎 (Target Language: ${lang || 'cn'})`);

    // 4. 呼叫流式引擎 (复用已有的可靠管道)
    const streamResponse = await createDeepSeekStream(messages);

    logger.success('暗影卷宗流式管道已连接，开始向客户端泵入字节流');

    // 5. 原生流透传 (打通前端 SSE 链路)
    return new Response(streamResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '暗影卷宗流式网关级联失效';
    logger.crash(errMsg);
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
}