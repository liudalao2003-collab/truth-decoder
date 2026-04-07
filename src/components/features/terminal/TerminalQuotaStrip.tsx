"use client";

import { Crown, Terminal } from 'lucide-react';
import type { TerminalQuotaPublic } from '@/lib/terminal-quota';

interface TerminalQuotaStripProps {
  quota: TerminalQuotaPublic | null;
  lang: 'cn' | 'en';
  hasSession: boolean;
  className?: string;
}

/**
 * PRO Terminal 月度审讯次数说明：免费用户显示剩余次数，Pro 标明无限次。
 */
export default function TerminalQuotaStrip({
  quota,
  lang,
  hasSession,
  className = '',
}: TerminalQuotaStripProps) {
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
              ? 'Pro：终端审讯无限次'
              : 'Pro: Unlimited terminal interrogations'}
          </span>
        </div>
        <p className="pl-[22px] text-[11px] leading-snug text-amber-900/85">
          {lang === 'cn'
            ? '向深度审讯终端发起无限次追问，不受月度配额限制。'
            : 'Unlimited interrogations via the PRO Terminal, no monthly cap.'}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700 shadow-sm ${className}`}
      role="status"
    >
      <div className="flex items-center gap-2">
        <Terminal className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
        <p className="text-[11px] leading-snug text-zinc-600">
          {lang === 'cn'
            ? '深度审讯终端按月限额（UTC），Pro 会员无限次。'
            : 'PRO Terminal capped monthly (UTC). Pro members get unlimited access.'}
        </p>
      </div>
      <p className="font-medium text-zinc-800">
        {lang === 'cn' ? (
          <>
            本月终端审讯剩余{' '}
            <span className="tabular-nums font-semibold text-zinc-900">
              {quota.remaining} / {quota.limit}
            </span>{' '}
            次（UTC {quota.period}）
          </>
        ) : (
          <>
            Terminal quota this month:{' '}
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
