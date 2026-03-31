import { TerminalMessage } from '@/types';

// 核心业务说明：此模块专门负责建立与 DeepSeek 的流式连接 (SSE)。
// 剥离了所有 UI 逻辑，只提供纯粹的 Response 对象流供上层网关消费。
export async function createDeepSeekStream(messages: TerminalMessage[], isJson: boolean = false): Promise<Response> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.log('🔴 [错误捕获] -> 节点: 流式引擎层 - API Key 物理级缺失');
    throw new Error('系统配置异常：未侦测到神经引擎访问令牌。');
  }

  console.log(`🟡 [网络请求] -> 接口: api.deepseek.com/chat/completions (Stream, JSON_MODE: ${isJson}), 记忆链长度:`, messages.length);
  
  // 防御性编程：强制拦截过长上下文，防止 Token 爆炸与恶意刷量
  if (messages.length > 20) {
    console.log('🔴 [错误捕获] -> 节点: 流式引擎层 - 上下文超载');
    throw new Error('上下文记忆链超出阈值，已强制阻断。');
  }

  const payload: Record<string, unknown> = {
    model: 'deepseek-chat',
    messages: messages,
    stream: true, 
    temperature: 0.3, 
    // 🚀 核心扩容：强行拉满单次输出 Token 上限，防止宏大叙事被腰斩
    max_tokens: 8192,
    // 🚨 V6.3 物理级紧箍咒：彻底打断 LLM 的无限复读机幻觉
    frequency_penalty: 0.4, 
    presence_penalty: 0.4   
  };

  // 🛡️ 架构师防线：强制接管 AST 语法树，开启底层 JSON 规范校验
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