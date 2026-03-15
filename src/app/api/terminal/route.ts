import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalStreamPayload } from '@/types';

// 强制使用 Edge Runtime，避免 Node.js 阻塞，获得极低延迟的流式处理性能
export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    // 1. 解析与安全校验 (绝对的 TS 纯洁性)
    const body = await request.json();
    const { signalId, messages } = body as TerminalStreamPayload;

    console.log(`🟢 [状态发起] -> 变量: 接收到 Terminal 流式请求, Signal: ${signalId}`);

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.log('🔴 [错误捕获] -> 节点: Terminal 网关 - 记忆链为空或格式异常');
      return new Response(JSON.stringify({ error: '无效的上下文记忆链' }), { status: 400 });
    }

    // 2. 注入系统级护栏指令 (拦截越狱与偏题)
    // 商业逻辑约束：确保用户的追问始终围绕“商业事实”，防止用户拿此终端当免费闲聊工具
    const systemGuardrail = {
      role: 'system',
      content: '你现在是 TruthDecoder 的深度审讯终端。基于之前的去伪存真报告，使用极度冷峻、客观、无情的数据化口吻回答用户的追问。禁止使用任何反问句、感叹号或共情语。如果用户的问题偏离商业、金融、人事或权力更迭，冷酷地拒绝回答。'
    };

    // 此处的 as any 是为了绕过 TS 对护栏类型的严苛推导，强行注入数组最前端
    const safeMessages = [systemGuardrail, ...messages] as typeof messages;

    // 3. 呼叫流式引擎
    const streamResponse = await createDeepSeekStream(safeMessages);

    console.log('🔵 [数据渲染] -> 组件: Terminal 网关流式管道已连接，开始向客户端泵入字节流');

    // 4. 原生流透传
    // 将 DeepSeek 的原生流直接透传给客户端，不经过任何中间缓冲，实现打字机效果
    return new Response(streamResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '流式网关级联失效';
    console.log('🔴 [错误捕获] -> 节点: Terminal 网关异常', errMsg);
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
}