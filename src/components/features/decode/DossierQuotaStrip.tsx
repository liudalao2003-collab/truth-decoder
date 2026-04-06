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
        className={`flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 shadow-sm ${className}`}
        role="status"
      >
        <Crown className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden />
        <span className="font-medium tracking-tight">
          {lang === 'cn'
            ? 'Pro：暗影卷宗无限次'
            : 'Pro: Unlimited dossier generations'}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 shadow-sm ${className}`}
      role="status"
    >
      <span className="font-medium">
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
      </span>
    </div>
  );
}
