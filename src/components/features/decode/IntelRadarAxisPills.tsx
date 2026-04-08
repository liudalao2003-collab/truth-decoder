'use client';

import type { IntelProfileRadarKey } from '@/types/intel-profile';
import { RADAR_AXIS_ORDER, radarLabels } from '@/lib/intel-profile-ui';

interface IntelRadarAxisPillsProps {
  selected: IntelProfileRadarKey | null;
  onSelect: (key: IntelProfileRadarKey) => void;
  lockedKeys: ReadonlySet<IntelProfileRadarKey>;
  lang: 'cn' | 'en';
  onLockedClick: () => void;
}

/**
 * 雷达轴快捷按钮：点击后滚动到右侧对应依据块，降低「一屏到底」的单调感。
 */
export default function IntelRadarAxisPills({
  selected,
  onSelect,
  lockedKeys,
  lang,
  onLockedClick,
}: IntelRadarAxisPillsProps) {
  return (
    <div className="flex flex-wrap justify-center lg:justify-start gap-1.5 mt-3 w-full max-w-[260px]">
      {RADAR_AXIS_ORDER.map((key) => {
        const locked = lockedKeys.has(key);
        const active = selected === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => {
              if (locked) onLockedClick();
              else onSelect(key);
            }}
            className={`text-[9px] font-mono px-2 py-1 rounded-md border transition-all max-w-[120px] truncate ${
              locked
                ? 'border-zinc-200 text-zinc-400 bg-zinc-100 cursor-pointer'
                : active
                  ? 'border-red-300 bg-red-50 text-red-900 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-red-50/50'
            }`}
            title={radarLabels(key, lang)}
          >
            {locked ? 'LOCK' : ''} {radarLabels(key, lang)}
          </button>
        );
      })}
    </div>
  );
}
