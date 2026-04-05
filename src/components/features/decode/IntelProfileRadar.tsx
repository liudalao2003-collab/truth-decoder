'use client';

import type { IntelProfileRadarKey } from '@/types/intel-profile';
import { RADAR_AXIS_ORDER } from '@/lib/intel-profile-ui';

interface IntelProfileRadarProps {
  scores: Record<IntelProfileRadarKey, number>;
  lockedKeys: ReadonlySet<IntelProfileRadarKey>;
  lang: 'cn' | 'en';
  size?: number;
}

/**
 * 纯 SVG 四维雷达：未登录时对 lockedKeys 对应轴仅显示占位刻度，不展示真实分值形状。
 * 网格与填充使用 slate 冷色令牌，与品牌红解耦，避免「贴纸感」。
 */
export default function IntelProfileRadar({
  scores,
  lockedKeys,
  lang,
  size = 200,
}: IntelProfileRadarProps) {
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.38;
  const n = RADAR_AXIS_ORDER.length;

  const angleForIndex = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;

  const pointFor = (key: IntelProfileRadarKey, i: number) => {
    const locked = lockedKeys.has(key);
    const v = locked ? 0 : Math.min(100, Math.max(0, scores[key])) / 100;
    const a = angleForIndex(i);
    return { x: cx + maxR * v * Math.cos(a), y: cy + maxR * v * Math.sin(a) };
  };

  const polyPoints = RADAR_AXIS_ORDER.map((k, i) => {
    const p = pointFor(k, i);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(' ');

  const gridLevels = [0.25, 0.5, 0.75, 1];

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 text-[color:var(--td-slate-grid)]"
      aria-hidden
    >
      {gridLevels.map((lv) => (
        <polygon
          key={lv}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.32}
          strokeWidth={1}
          points={RADAR_AXIS_ORDER.map((_, i) => {
            const a = angleForIndex(i);
            return `${cx + maxR * lv * Math.cos(a)},${cy + maxR * lv * Math.sin(a)}`;
          }).join(' ')}
        />
      ))}
      {RADAR_AXIS_ORDER.map((key, i) => {
        const a = angleForIndex(i);
        const x2 = cx + maxR * Math.cos(a);
        const y2 = cy + maxR * Math.sin(a);
        return (
          <line
            key={key}
            x1={cx}
            y1={cy}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeOpacity={0.55}
            strokeWidth={1}
          />
        );
      })}
      <polygon
        fill="var(--td-slate-radar-fill)"
        stroke="var(--td-slate-stroke)"
        strokeWidth={2}
        points={polyPoints}
      />
      {RADAR_AXIS_ORDER.map((key, i) => {
        const locked = lockedKeys.has(key);
        const v = locked ? 0 : scores[key];
        const a = angleForIndex(i);
        const lx = cx + (maxR + 14) * Math.cos(a);
        const ly = cy + (maxR + 14) * Math.sin(a);
        const anchor = Math.cos(a) > 0.3 ? 'start' : Math.cos(a) < -0.3 ? 'end' : 'middle';
        const baseline = Math.sin(a) > 0.4 ? 'hanging' : Math.sin(a) < -0.4 ? 'auto' : 'middle';
        return (
          <text
            key={`lbl-${key}`}
            x={lx}
            y={ly}
            textAnchor={anchor}
            dominantBaseline={baseline}
            className="fill-zinc-700 font-mono uppercase"
            style={{ fontSize: 7 }}
          >
            {locked ? 'LOCK' : Math.round(v)}
          </text>
        );
      })}
      <text
        x={cx}
        y={size - 6}
        textAnchor="middle"
        className="fill-slate-600"
        style={{ fontSize: 8 }}
      >
        {lang === 'cn' ? '情报体征 · 雷达' : 'Intel signature'}
      </text>
    </svg>
  );
}

export function IntelProfileMiniBars(props: {
  scores: Record<IntelProfileRadarKey, number>;
  lockedKeys: ReadonlySet<IntelProfileRadarKey>;
  lang: 'cn' | 'en';
}) {
  const { scores, lockedKeys, lang } = props;
  return (
    <div className="flex flex-col gap-1 w-full min-w-[72px] max-w-[100px]" aria-hidden>
      {RADAR_AXIS_ORDER.map((key) => {
        const locked = lockedKeys.has(key);
        const w = locked ? 8 : Math.round(Math.min(100, Math.max(0, scores[key])));
        return (
          <div key={key} className="flex items-center gap-1">
            <div className="h-1 flex-1 bg-zinc-200 rounded-sm overflow-hidden border border-zinc-300">
              <div
                className={`h-full rounded-sm ${locked ? 'bg-zinc-400' : 'bg-slate-600'}`}
                style={{ width: locked ? '12%' : `${w}%` }}
              />
            </div>
          </div>
        );
      })}
      <span className="text-[6px] font-mono text-zinc-600 uppercase truncate">
        {lang === 'cn' ? '体征' : 'SIG'}
      </span>
    </div>
  );
}
