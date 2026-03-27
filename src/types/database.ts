// 核心说明书：
// 数据库实体契约。已彻底消除 fluff_words、hard_facts 以及 metadata 中的 any 毒瘤。
// 引入 BilingualData 确保双语数据的严密性，同时保留旧版 string[] 的类型兼容性防断层。

export interface BilingualData {
  cn: string[];
  en: string[];
}

// 🚀 新增：暗影卷宗专属的双语长文契约
export interface BilingualDossier {
  cn: string;
  en: string;
}

export interface SignalRecord {
  id: string;
  created_at: string;
  raw_content: string;
  verdict: string;
  hard_facts: BilingualData | string[]; 
  fluff_words: BilingualData | string[]; 
  view_count: number;
  // 🚀 核心升维：强制要求 JSONB 双语格式，并用 string 托底旧版数据
  dossier_content?: BilingualDossier | string;
  metadata?: {
    bilingual?: {
      cn?: string;
      en?: string;
    };
    washed?: boolean;
    // 严禁 any 投毒，使用 unknown 确保 TS 纯洁性
    [key: string]: unknown; 
  };
}