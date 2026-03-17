import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalStreamPayload, TerminalMessage } from '@/types';
import { logger } from '@/utils/logger';

// 强制使用 Edge Runtime，避免 Node.js 阻塞，获得极低延迟的流式处理性能 [cite: 61]
export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    // 1. 解析与安全校验 (绝对的 TS 纯洁性) [cite: 62]
    const body = await request.json();
    const { signalId, messages } = body as TerminalStreamPayload;

    logger.start(`接收到 Terminal 流式请求, Signal: ${signalId}`);

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      logger.crash('Terminal 网关 - 记忆链为空或格式异常');
      return new Response(JSON.stringify({ error: '无效的上下文记忆链' }), { status: 400 });
    }

    // 2. 注入系统级护栏指令 (拦截越狱与偏题) [cite: 66]
    // 严密契约：直接声明为 TerminalMessage 类型，彻底消灭 as 强转
    const systemGuardrail: TerminalMessage = {
      role: 'system',
      content: '你现在是 TruthDecoder 的深度审讯终端。基于之前的去伪存真报告，使用极度冷峻、客观、无情的数据化口吻回答用户的追问。禁止使用任何反问句、感叹号或共情语。如果用户的问题偏离商业、金融、人事或权力更迭，冷酷地拒绝回答。'
    };

    // 纯洁的数组解构拼装，TS 类型严丝合缝
    const safeMessages: TerminalMessage[] = [systemGuardrail, ...messages];

    // 3. 呼叫流式引擎 [cite: 68]
    const streamResponse = await createDeepSeekStream(safeMessages);

    logger.success('Terminal 网关流式管道已连接，开始向客户端泵入字节流');

    // 4. 原生流透传 [cite: 69]
    return new Response(streamResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '流式网关级联失效';
    logger.crash(errMsg);
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
}