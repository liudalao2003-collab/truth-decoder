import { TerminalMessage } from '@/types';

/**
 * 核心业务：DeepSeek 流式请求服务层
 *
 * V9.0 修复：新增 maxTokens 参数，允许调用方按需控制 Token 上限。
 * 暗影卷宗生成需要 16000 tokens 才能保证内容深度，
 * 其他接口（终端审讯等）继续使用默认的 8192。
 */
export async function createDeepSeekStream(
  messages: TerminalMessage[],
  isJson: boolean = false,
  // 🔧 BUG-2 FIX: 新增 maxTokens 参数，默认保持 8192 向后兼容，卷宗生成传入 16000
  maxTokens: number = 8192
): Promise<Response> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.log('🔴 [错误捕获] -> 节点: 流式引擎层 - API Key 物理级缺失');
    throw new Error('系统配置异常：未侦测到神经引擎访问令牌。');
  }

  console.log(`🟡 [网络请求] -> 接口: api.deepseek.com/chat/completions (Stream, JSON_MODE: ${isJson}, MAX_TOKENS: ${maxTokens}), 记忆链长度:`, messages.length);
  
  if (messages.length > 20) {
    console.log('🔴 [错误捕获] -> 节点: 流式引擎层 - 上下文超载');
    throw new Error('上下文记忆链超出阈值，已强制阻断。');
  }

  const payload: Record<string, unknown> = {
    model: 'deepseek-chat',
    messages: messages,
    stream: true, 
    temperature: 0.3, 
    max_tokens: maxTokens,
    // 🚨 架构师 V6.7 修复：彻底废除 frequency_penalty。这是导致大模型中英混杂、乱造词汇的物理元凶！
  };

  if (isJson) {
    payload.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.log('🔴 [错误捕获] -> 节点: 流式引擎连接中断', errorData);
    throw new Error(`上游通信失败: HTTP ${response.status}`);
  }

  console.log('🟢 [状态发起] -> 变量: 流式通道已成功握手');
  return response;
}