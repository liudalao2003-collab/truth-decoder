import { SignalRecord } from '@/types/database';
import {
  buildIntelExportBlocks,
  intelExportBlocksToMarkdown,
} from '@/lib/intel-export-sections';

/**
 * 机构向 Markdown 简报：判决、硬事实、情报体征（与导出块 brief 模式一致，无原文/卷宗）。
 */
export function buildIntelBriefMarkdown(
  record: SignalRecord,
  lang: 'cn' | 'en'
): string {
  return intelExportBlocksToMarkdown(
    buildIntelExportBlocks(record, lang, { mode: 'brief' })
  );
}
