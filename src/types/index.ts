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