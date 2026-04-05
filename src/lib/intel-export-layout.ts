import type { IntelExportBlock } from '@/lib/intel-export-sections';

export interface IntelExportPartition {
  /** 开头的 doc_title + meta（按出现顺序） */
  hero: IntelExportBlock[];
  /** 每个子数组以 h2 开头，直至下一 h2 前（含） */
  sections: IntelExportBlock[][];
}

/**
 * 将扁平导出块切成顶栏 hero 与分节卡片，PDF 与长图共用同一逻辑。
 */
export function partitionExportBlocks(blocks: IntelExportBlock[]): IntelExportPartition {
  const hero: IntelExportBlock[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.type === 'doc_title' || b.type === 'meta') {
      hero.push(b);
      i += 1;
      continue;
    }
    break;
  }

  const rest = blocks.slice(i);
  const sections: IntelExportBlock[][] = [];
  let current: IntelExportBlock[] = [];

  for (const b of rest) {
    if (b.type === 'h2' && current.length > 0) {
      sections.push(current);
      current = [b];
    } else {
      current.push(b);
    }
  }
  if (current.length > 0) {
    sections.push(current);
  }

  return { hero, sections };
}
