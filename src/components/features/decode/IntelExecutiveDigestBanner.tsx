'use client';

import { Lock, Sparkles } from 'lucide-react';
import type { IntelExecutiveDigest } from '@/lib/intel-executive-digest';
import type { IntelProfileRadarKey } from '@/types/intel-profile';
import { radarLabels } from '@/lib/intel-profile-ui';

interface IntelExecutiveDigestBannerProps {
  digest: IntelExecutiveDigest;
  lang: 'cn' | 'en';
  unlocked: boolean;
  onRequireAuth: () => void;
  /** 点击某条研判时滚动到对应雷达依据 */
  onJumpToAxis?: (key: IntelProfileRadarKey) => void;
}

/**
 * 结论前置：三条高分轴依据 + 可核验性不确定性，提升首屏获得感。
 */
export default function IntelExecutiveDigestBanner({
  digest,
  lang,
  unlocked,
  onRequireAuth,
  onJumpToAxis,
}: IntelExecutiveDigestBannerProps) {
  return (
    <div className="mx-6 mt-4 mb-2 rounded-lg border border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-white to-zinc-50/80 p-4 shadow-sm ring-1 ring-amber-100/60">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-amber-100 p-2 text-amber-800">
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-amber-900/70">
              {lang === 'cn' ? '结论前置' : 'Executive read'}
            </p>
            <h3 className="text-sm font-semibold text-zinc-900 mt-0.5">{digest.headline}</h3>
          </div>
          <ol className="list-decimal pl-4 space-y-2 text-xs text-zinc-800 leading-relaxed">
            {digest.judgments.map((j, i) => (
              <li key={i} className="pl-1">
                {j.locked ? (
                  <button
                    type="button"
                    onClick={onRequireAuth}
                    className="inline-flex items-center gap-1.5 text-left text-zinc-500 hover:text-red-600 transition-colors group w-full"
                  >
                    <Lock className="w-3.5 h-3.5 shrink-0" />
                    <span className="font-mono">
                      {lang === 'cn' ? '登录解锁本条研判依据。' : 'Sign in to unlock this line.'}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => j.axisKey && onJumpToAxis?.(j.axisKey)}
                    className="text-left w-full hover:text-red-800 transition-colors rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                  >
                    <span className="text-zinc-600 font-mono text-[10px] uppercase tracking-wide mr-2">
                      {j.axisKey ? radarLabels(j.axisKey, lang) : ''}
                    </span>
                    {j.text}
                  </button>
                )}
              </li>
            ))}
          </ol>
          <div className="rounded-md border border-dashed border-zinc-300 bg-white/70 px-3 py-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 mb-1">
              {lang === 'cn' ? '认知不确定性（可核验轴）' : 'Epistemic gap (verifiability)'}
            </p>
            {digest.uncertainty.locked ? (
              <button
                type="button"
                onClick={onRequireAuth}
                className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-600"
              >
                <Lock className="w-3.5 h-3.5" />
                {lang === 'cn' ? '登录查看可核验性分析。' : 'Sign in for verifiability analysis.'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onJumpToAxis?.('verifiability')}
                className="text-xs text-zinc-800 leading-relaxed text-left w-full hover:text-red-900 transition-colors"
              >
                {digest.uncertainty.text}
              </button>
            )}
          </div>
          {!unlocked && (
            <p className="text-[10px] text-zinc-500 font-mono">
              {lang === 'cn'
                ? '利益纠缠 / 行动诱导两维与沙盘、核验清单在登录 Pro 后展开。'
                : 'Tension & action axes, board, and checklist unlock with Pro.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
