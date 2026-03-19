// 核心业务说明：定义 Supabase 数据库表结构的 TypeScript 映射。
// 确保前后端数据流转时的绝对类型安全。

export interface SignalRecord {
  id: string;
  raw_content: string;
  fluff_words: string[];
  hard_facts: string[];
  verdict: string;
  view_count: number;
  created_at: string;
}