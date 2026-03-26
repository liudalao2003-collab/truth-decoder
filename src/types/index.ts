import { BilingualData } from './database';

// 🚀 核心解码结果契约：全站唯一真理来源 (V5.6 双语适配版 + 暗影卷宗版)
export interface DecodeResult {
  // 适配新版 { cn: string[], en: string[] } 或旧版 string[]
  fluffWords: BilingualData | string[];
  hardFacts: BilingualData | string[];
  // verdict 现在也可能包含 metadata 里的双语对象
  verdict: any;
  // 🚀 核心新增：暗影卷宗的长文承载字段
  dossierContent?: string;
}

// 统一的 API 响应契约
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// --- 深度审讯终端 (Chat Terminal) 状态机契约 ---

// 单条对话记忆上下文 (严格遵循大模型角色分离原则)
export interface TerminalMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// 流式请求载荷 (前端打向后端的弹药)
export interface TerminalStreamPayload {
  signalId: string; // 绑定的原始通稿 ID
  messages: TerminalMessage[]; // 完整的上下文记忆链
}
