import type { IntelProfileRadarKey } from '@/types/intel-profile';

export const RADAR_AXIS_ORDER: IntelProfileRadarKey[] = [
  'narrativeIncitement',
  'stakeholderEntanglement',
  'verifiability',
  'actionUrging',
];

const GUEST_OPEN_KEYS: IntelProfileRadarKey[] = ['narrativeIncitement', 'verifiability'];

/** 未登录时开放「叙事煽动 + 可核验性」两维，与结论前置预览一致 */
export function guestIntelLockedKeys(): Set<IntelProfileRadarKey> {
  return new Set(RADAR_AXIS_ORDER.filter((k) => !GUEST_OPEN_KEYS.includes(k)));
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
