export interface SignalRecord {
  id: string;
  created_at: string;
  raw_content: string;
  verdict: string;
  hard_facts: any; // 兼容旧数组和新版双语对象
  fluff_words: any; // 兼容旧数组和新版双语对象
  view_count: number;
  
  // 🚀 核心修复：注入 metadata 基因
  metadata?: {
    bilingual?: {
      cn?: string;
      en?: string;
    };
    washed?: boolean;
    [key: string]: any; // 允许未来扩展其他元数据
  };
}