import type { IntelProfile, IntelProfileRadarKey } from '@/types/intel-profile';
import { RADAR_AXIS_ORDER } from '@/lib/intel-profile-ui';

/** 单条研判或不确定性：locked 表示未登录时占位，不展示真实文案 */
export type IntelDigestLine = {
  text: string;
  locked: boolean;
  axisKey?: IntelProfileRadarKey;
};

export type IntelExecutiveDigest = {
  /** 区块主标题 */
  headline: string;
  /** 至多三条：高分轴上的依据（尽量合并前两 bullet，减少敷衍感） */
  judgments: IntelDigestLine[];
  /** 以「可核验性」轴为认知不确定性 */
  uncertainty: IntelDigestLine;
};

const GUEST_OPEN_KEY: IntelProfileRadarKey = 'narrativeIncitement';

function linesFor(
  profile: IntelProfile,
  key: IntelProfileRadarKey,
  lang: 'cn' | 'en'
): string[] {
  const block = profile.rationale[key];
  return lang === 'cn' ? block.cn : block.en;
}

/**
 * 合并前两则依据 bullet（控制总长），比单句更像「段落级」结论。
 */
function digestTextForAxis(
  profile: IntelProfile,
  key: IntelProfileRadarKey,
  lang: 'cn' | 'en'
): string {
  const arr = linesFor(profile, key, lang);
  const a = (arr[0] ?? '').trim();
  const b = (arr[1] ?? '').trim();
  if (!b) return a;
  const combined = `${a} ${b}`;
  const max = lang === 'cn' ? 280 : 420;
  return combined.length > max ? a : combined;
}

/**
 * 从现有 radar + rationale 合成「一页纸」结论区，无需改 API schema。
 * 未登录：叙事 + 可核验性预览（与雷达开放维度一致），其余占位。
 */
export function buildIntelExecutiveDigest(
  profile: IntelProfile,
  lang: 'cn' | 'en',
  unlocked: boolean
): IntelExecutiveDigest {
  if (!unlocked) {
    return {
      headline:
        lang === 'cn'
          ? '核心速写（登录解锁利益纠缠 / 行动诱导与沙盘）'
          : 'Core read (sign in for tension, action pressure & boards)',
      judgments: [
        {
          text: digestTextForAxis(profile, GUEST_OPEN_KEY, lang),
          locked: false,
          axisKey: GUEST_OPEN_KEY,
        },
        { text: '', locked: true },
        { text: '', locked: true },
      ],
      uncertainty: {
        text: digestTextForAxis(profile, 'verifiability', lang),
        locked: false,
        axisKey: 'verifiability',
      },
    };
  }

  const others = RADAR_AXIS_ORDER.filter((k) => k !== 'verifiability');
  const scored = others
    .map((k) => ({
      k,
      s: profile.radar[k],
    }))
    .sort((a, b) => b.s - a.s);

  const top3 = scored.slice(0, 3);
  const judgments: IntelDigestLine[] = top3.map(({ k }) => ({
    text: digestTextForAxis(profile, k, lang),
    locked: false,
    axisKey: k,
  }));

  const uncertainty: IntelDigestLine = {
    text: digestTextForAxis(profile, 'verifiability', lang),
    locked: false,
    axisKey: 'verifiability',
  };

  return {
    headline:
      lang === 'cn'
        ? '一页纸研判（由体征模型依据自动提炼）'
        : 'One-page read (auto from intel rationale)',
    judgments,
    uncertainty,
  };
}
