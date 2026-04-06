"use client";

import { Crown } from 'lucide-react';
import type { DossierQuotaPublic } from '@/lib/dossier-quota';

interface DossierQuotaStripProps {
  quota: DossierQuotaPublic | null;
  lang: 'cn' | 'en';
  hasSession: boolean;
  className?: string;
}

/**
 * 暗影卷宗月度额度说明：免费用户显示剩余次数，Pro 标明无限次。
 */
export default function DossierQuotaStrip({
  quota,
  lang,
  hasSession,
  className = '',
}: DossierQuotaStripProps) {
  if (!hasSession || !quota) {
    return null;
  }

  if (quota.isUnlimited) {
    return (
      <div
        className={`flex flex-col gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 shadow-sm ${className}`}
        role="status"
      >
        <div className="flex items-center gap-2">
          <Crown className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />
          <span className="font-medium tracking-tight">
            {lang === 'cn'
              ? 'Pro：暗影卷宗无限次'
              : 'Pro: Unlimited dossier generations'}
          </span>
        </div>
        <p className="pl-[22px] text-[11px] leading-snug text-amber-900/85">
          {lang === 'cn'
            ? '载入引擎解析报道不限次数。'
            : 'Unlimited report parsing via the ingest engine.'}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 shadow-sm ${className}`}
      role="status"
    >
      <p className="text-[11px] leading-snug text-zinc-600">
        {lang === 'cn'
          ? '载入引擎解析报道不限次数；仅「暗影卷宗」长文按月限额（UTC）。'
          : 'Unlimited report parsing; only Shadow Dossier (long-form) is capped monthly (UTC).'}
      </p>
      <p className="font-medium text-zinc-800">
        {lang === 'cn' ? (
          <>
            本月暗影卷宗剩余{' '}
            <span className="tabular-nums font-semibold text-zinc-900">
              {quota.remaining} / {quota.limit}
            </span>{' '}
            次（UTC {quota.period}）
          </>
        ) : (
          <>
            Dossier quota this month:{' '}
            <span className="tabular-nums font-semibold text-zinc-900">
              {quota.remaining} / {quota.limit}
            </span>{' '}
            (UTC {quota.period})
          </>
        )}
      </p>
    </div>
  );
}
