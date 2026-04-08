'use client';

import { Loader2, RefreshCw } from 'lucide-react';

/**
 * 入库后 enrich 尚未落盘时的体征区骨架，避免「空白→突然出现」的廉价感。
 */
export default function IntelProfileLoadingSkeleton({
  lang,
  onRetryProfile,
  retryDisabled = false,
  retrying = false,
  retryCooldownSec = 0,
}: {
  lang: 'cn' | 'en';
  onRetryProfile?: () => void;
  retryDisabled?: boolean;
  retrying?: boolean;
  retryCooldownSec?: number;
}) {
  return (
    <section className="mb-10 border border-[var(--td-border)] bg-[var(--td-surface-1)] rounded-lg overflow-hidden shadow-md ring-1 ring-[var(--td-ring)]">
      <header className="px-6 py-4 border-b border-[var(--td-border)] bg-zinc-50/90">
        <div className="animate-pulse">
          <div className="h-3 w-24 bg-zinc-200 rounded mb-2" />
          <div className="h-5 w-40 bg-zinc-200 rounded mb-2" />
          <div className="h-3 w-full max-w-md bg-zinc-100 rounded" />
        </div>
      </header>
      <div className="p-6 space-y-4 animate-pulse">
          <div className="h-24 rounded-lg bg-amber-50/80 border border-amber-100" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 flex justify-center">
              <div className="w-[220px] h-[220px] rounded-full bg-zinc-100 border border-zinc-200" />
            </div>
            <div className="lg:col-span-8 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-zinc-100 border border-zinc-200/80" />
              ))}
            </div>
          </div>
        </div>
      <p className="px-6 pb-2 text-[10px] font-mono text-zinc-500 text-center">
        {lang === 'cn'
          ? '体征与沙盘正在后台生成，通常数秒内完成；页面将自动刷新。'
          : 'Intel signature is generating; this page will refresh shortly.'}
      </p>
      {onRetryProfile ? (
        <div className="px-6 pb-5 flex items-center justify-center">
          <button
            type="button"
            onClick={onRetryProfile}
            disabled={retryDisabled}
            className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest px-4 py-2 rounded-md border border-zinc-200 bg-white text-zinc-700 hover:text-red-700 hover:border-red-300 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {retrying ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {retrying
              ? (lang === 'cn' ? '补算中…' : 'Retrying…')
              : (lang === 'cn' ? '重试体征补算' : 'Retry profile')}
            {!retrying && retryCooldownSec > 0
              ? ` (${retryCooldownSec}s)`
              : ''}
          </button>
        </div>
      ) : null}
    </section>
  );
}
