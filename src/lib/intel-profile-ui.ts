import type { IntelProfileRadarKey } from '@/types/intel-profile';

export const RADAR_AXIS_ORDER: IntelProfileRadarKey[] = [
  'narrativeIncitement',
  'stakeholderEntanglement',
  'verifiability',
  'actionUrging',
];

const GUEST_OPEN_KEY: IntelProfileRadarKey = 'narrativeIncitement';

/** 未登录时仅开放「叙事煽动」一维的雷达/条形真实展示 */
export function guestIntelLockedKeys(): Set<IntelProfileRadarKey> {
  return new Set(
    RADAR_AXIS_ORDER.filter((k) => k !== GUEST_OPEN_KEY)
  );
}

export function emptyIntelLockedKeys(): Set<IntelProfileRadarKey> {
  return new Set();
}

export function radarLabels(
  key: IntelProfileRadarKey,
  lang: 'cn' | 'en'
): string {
  const map: Record<IntelProfileRadarKey, { cn: string; en: string }> = {
    narrativeIncitement: { cn: '叙事煽动', en: 'Narrative leverage' },
    stakeholderEntanglement: { cn: '利益纠缠', en: 'Stakeholder tension' },
    verifiability: { cn: '可核验性', en: 'Verifiability' },
    actionUrging: { cn: '行动诱导', en: 'Action pressure' },
  };
  return map[key][lang];
}
