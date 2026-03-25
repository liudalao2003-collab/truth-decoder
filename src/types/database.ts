export interface SignalRecord { 
  id: string; 
  created_at: string; 
  raw_content: string; 
  verdict: string; 
  hard_facts: any; // 兼容旧数组和新版双语对象 
  fluff_words: any; // 兼容旧数组和新版双语对象 
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