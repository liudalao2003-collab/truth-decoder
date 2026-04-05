import type { IntelExportSectionKey } from '@/lib/intel-export-sections';

/** 与站内 --td-accent 对齐 */
export const EXPORT_BRAND_HEX = '#dc2626';

/** PDF / 长图共用深色报告色板（与应用内浅色 UI 独立） */
export const INTEL_EXPORT_THEME = {
  pageBg: '#09090b',
  heroBg: '#0c0c0e',
  cardBg: '#141416',
  cardBgNarrative: '#101012',
  cardBorder: '#27272a',
  textPrimary: '#fafafa',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  brand: EXPORT_BRAND_HEX,
  /** 分节标题强调色 */
  sectionAccent: {
    verdict: '#f87171',
    hard_facts: '#fbbf24',
    intel: '#22d3ee',
    intel_radar: '#2dd4bf',
    rationale: '#c4b5fd',
    stakeholders: '#4ade80',
    verification: '#fde047',
    audit: '#94a3b8',
    source: '#38bdf8',
    dossier: '#60a5fa',
    terminal: '#fb7185',
  } satisfies Record<IntelExportSectionKey, string>,
  radiusPx: 10,
  cardPaddingPx: 18,
  sectionGapPx: 16,
  heroPaddingPx: 22,
} as const;

export function exportSectionAccent(key: IntelExportSectionKey): string {
  return INTEL_EXPORT_THEME.sectionAccent[key];
}

/** 原文 / 卷宗：等宽栈以增强「长文档案」感 */
export function exportSectionUsesNarrativeMono(key: IntelExportSectionKey): boolean {
  return key === 'source' || key === 'dossier';
}
