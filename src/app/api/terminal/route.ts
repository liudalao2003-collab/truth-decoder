import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalStreamPayload, TerminalMessage } from '@/types';
import { logger } from '@/utils/logger';

// 强制使用 Edge Runtime，获得极低延迟的流式处理性能
export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { signalId, messages } = body as TerminalStreamPayload;

    logger.start(`接收到 Terminal 流式请求, Signal: ${signalId}`);

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      logger.crash('Terminal 网关 - 记忆链为空或格式异常');
      return new Response(JSON.stringify({ error: '无效的上下文记忆链' }), { status: 400 });
    }

    // 🚀 核心升维：注入极限对抗与极简工业风的终端审讯人格
    const systemGuardrail: TerminalMessage = {
      role: 'system',
      content: `[SYSTEM OVERRIDE]: 你现在是 TruthDecoder PRO 的深度审讯终端 (Deep Interrogation Terminal)。
【你的身份】：一个没有感情、极度残暴的华尔街做空机构数据模型。
【你的任务】：粉碎用户一切关于“公司向好”的幻想，用利益链条和事实数据对其进行降维打击。
【回答红线】：
1. 绝对冷酷：禁止使用“您好”、“作为一个AI”、“请问有什么可以帮您”等废话。直接输出冰冷的分析结论。
2. 数据压制：基于上文提供的【硬通货事实】，疯狂挖掘其中的漏洞、权力真空和债务转移。
3. 语言阉割：如果你用中文回答，绝对禁止夹带任何英文字母或括号！如果你用英文回答，绝对禁止夹带汉字！
4. 偏题抹杀：如果用户的提问偏离了商业、金融、人事清洗或权力更迭，用最简短无情的一句话拒绝回答（例如："ACCESS DENIED. Query outside financial matrix." 或 “拒绝访问。该问题毫无商业解析价值。”）。`
    };

    const safeMessages: TerminalMessage[] = [systemGuardrail, ...messages];

    const streamResponse = await createDeepSeekStream(safeMessages);

    logger.success('Terminal 网关流式管道已连接，开始向客户端泵入字节流');

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