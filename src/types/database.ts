
// 核心说明书：
// 数据库实体契约。已彻底消除 fluff_words 和 hard_facts 中的 any 毒瘤。
// 引入 BilingualData 确保双语数据的严密性，同时保留旧版 string[] 的类型兼容性防断层。

export interface BilingualData {
  cn: string[];
  en: string[];
}

export interface SignalRecord {
  id: string;
  created_at: string;
  raw_content: string;
  verdict: string;
  hard_facts: BilingualData | string[]; // 兼容旧数组和新版双语对象
  fluff_words: BilingualData | string[]; // 兼容旧数组和新版双语对象
  view_count: number;
  // 🚀 核心新增：暗影卷宗完整流式长文载体 (零破坏原则：允许为 undefined 以兼容旧数据)
  dossier_content?: string;
  metadata?: {
    bilingual?: {
      cn?: string;
      en?: string;
    };
    washed?: boolean;
    [key: string]: any; // 允许未来扩展其他元数据
  };
}
