// 核心解码结果契约，全站唯一真理来源
export interface DecodeResult {
  fluffWords: string[];
  hardFacts: string[];
  verdict: string;
}

// 统一的 API 响应契约
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// --- 新增：深度审讯终端 (Chat Terminal) 状态机契约 ---

// 单条对话记忆上下文 (严格遵循大模型角色分离原则)
export interface TerminalMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// 流式请求载荷 (前端打向后端的弹药)
export interface TerminalStreamPayload {
  signalId: string; // 绑定的原始通稿 ID，用于后期商业化计费、鉴权或溯源
  messages: TerminalMessage[]; // 完整的上下文记忆链
}