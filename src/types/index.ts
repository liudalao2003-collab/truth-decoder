import { BilingualData, BilingualDossier } from './database';

// 🚀 核心解码结果契约：全站唯一真理来源 (V5.6 双语适配版 + 暗影卷宗版)
export interface DecodeResult {
  fluffWords: BilingualData | string[];
  hardFacts: BilingualData | string[];
  // 严禁 any 投毒
  verdict: unknown;
  // 🚀 核心对齐：上层业务对象同步升维双语卷宗
  dossierContent?: BilingualDossier | string;
}

// 统一的 API 响应契约
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// --- 深度审讯终端 (Chat Terminal) 状态机契约 ---

export interface TerminalMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface TerminalStreamPayload {
  signalId: string; 
  messages: TerminalMessage[];
}