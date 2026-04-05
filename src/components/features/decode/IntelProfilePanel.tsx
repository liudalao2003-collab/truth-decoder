'use client';

import { useState } from 'react';
import { ChevronDown, ListChecks, Lock, ShieldAlert, Users } from 'lucide-react';
import IntelProfileRadar from '@/components/features/decode/IntelProfileRadar';
import { RADAR_AXIS_ORDER, radarLabels } from '@/lib/intel-profile-ui';
import type { IntelProfile, IntelProfileError } from '@/types/intel-profile';
import type { IntelProfileRadarKey } from '@/types/intel-profile';

interface IntelProfilePanelProps {
  profile: IntelProfile | undefined;
  profileError: IntelProfileError | undefined;
  lang: 'cn' | 'en';
  unlocked: boolean;
  onRequireAuth: () => void;
}

const GUEST_OPEN_KEY: IntelProfileRadarKey = 'narrativeIncitement';

function lockedSetForGuest(): Set<IntelProfileRadarKey> {
  return new Set(
    RADAR_AXIS_ORDER.filter((k) => k !== GUEST_OPEN_KEY)
  );
}

const accordionBtnClass =
  'w-full flex items-center gap-3 px-6 py-3.5 border-t border-zinc-200 text-left text-[11px] font-semibold tracking-wide text-zinc-800 bg-slate-100 hover:bg-slate-100/90 hover:shadow-sm active:scale-[0.998] transition-all';

/**
 * 情报体征主面板：雷达 + 依据 + 沙盘 + 核验 + 审计；未登录仅开放叙事煽动一维。
 */
export default function IntelProfilePanel({
  profile,
  profileError,
  lang,
  unlocked,
  onRequireAuth,
}: IntelProfilePanelProps) {
  const [openStakeholders, setOpenStakeholders] = useState(false);
  const [openVerify, setOpenVerify] = useState(false);

  const lockedKeys = unlocked ? new Set<IntelProfileRadarKey>() : lockedSetForGuest();

  if (profileError && !profile) {
    return (
      <section className="mb-10 border border-red-900/40 bg-red-950/20 rounded-sm p-6">
        <div className="flex items-center gap-3 text-red-400 text-sm font-mono">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>
            {lang === 'cn'
              ? '情报体征生成失败（可稍后由管理员触发补算）。'
              : 'Intel signature failed (retry via admin/cron).'}
          </span>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <p className="mt-2 text-xs text-zinc-600 font-mono break-all">{profileError.message}</p>
        )}
      </section>
    );
  }

  if (!profile) {
    return (
      <section className="mb-10 border border-zinc-200 bg-zinc-50 rounded-lg p-6 text-zinc-600 text-sm font-mono">
        {lang === 'cn' ? '暂无情报体征数据。' : 'No intel signature on this signal.'}
      </section>
    );
  }

  const rationaleBlock = (key: IntelProfileRadarKey) => {
    const lines = profile.rationale[key];
    const show = unlocked || key === GUEST_OPEN_KEY;
    if (!show) {
      return (
        <button
          type="button"
          onClick={onRequireAuth}
          className="w-full text-left flex items-start gap-2 text-zinc-600 hover:text-red-600 transition-colors group"
        >
          <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-zinc-600 group-hover:text-red-600" />
          <span className="text-xs font-mono">
            {lang === 'cn' ? '登录解锁本维依据与沙盘。' : 'Sign in to unlock rationale and boards.'}
          </span>
        </button>
      );
    }
    const arr = lang === 'cn' ? lines.cn : lines.en;
    return (
      <ul className="list-disc pl-4 space-y-1 text-xs text-zinc-700 leading-relaxed">
        {arr.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    );
  };

  return (
    <section className="mb-10 border border-[var(--td-border)] bg-[var(--td-surface-1)] rounded-lg overflow-hidden shadow-md ring-1 ring-[var(--td-ring)]">
      <header className="px-6 py-4 border-b border-[var(--td-border)] bg-zinc-50/90 flex flex-wrap items-center justify-between gap-4">
        <div className="border-l-[3px] border-l-slate-600 pl-4 max-w-prose">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">
            Intel signature
          </p>
          <h2 className="text-base font-semibold text-zinc-900 tracking-tight mt-0.5">
            {lang === 'cn' ? '情报体征' : 'Intel signature'}
          </h2>
          <p className="text-xs text-zinc-600 mt-2 font-medium font-sans">
            {lang === 'cn'
              ? '模型辅助速写，非司法或审计结论。'
              : 'Model-assisted sketch, not a legal verdict.'}
          </p>
        </div>
        {!unlocked && (
          <button
            type="button"
            onClick={onRequireAuth}
            className="text-[10px] font-bold uppercase tracking-widest px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-md transition-colors shrink-0"
          >
            {lang === 'cn' ? '登录解锁全维' : 'Unlock full profile'}
          </button>
        )}
      </header>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 bg-zinc-50/50">
        <div className="lg:col-span-4 flex justify-center lg:justify-start">
          <div className="rounded-xl bg-[var(--td-instrument-surface)] ring-1 ring-slate-200/80 p-4 w-full max-w-[260px] flex justify-center lg:justify-start">
            <IntelProfileRadar
              scores={profile.radar}
              lockedKeys={lockedKeys}
              lang={lang}
              size={220}
            />
          </div>
        </div>
        <div className="lg:col-span-8 space-y-1 rounded-xl bg-white/90 ring-1 ring-zinc-200/60 p-4">
          {RADAR_AXIS_ORDER.map((key) => (
            <div
              key={key}
              className="border-b border-zinc-100 pb-4 pt-1 last:border-0 last:pb-1 rounded-lg px-2 -mx-1 hover:bg-zinc-50/90 transition-colors"
            >
              <h3 className="text-sm font-medium text-zinc-800 font-sans mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0">
                <span>{radarLabels(key, lang)}</span>
                <span className="tabular-nums text-slate-600 font-normal text-xs">
                  {profile.radar[key]}
                </span>
              </h3>
              {rationaleBlock(key)}
            </div>
          ))}
        </div>
      </div>

      {unlocked && (
        <>
          <button
            type="button"
            onClick={() => setOpenStakeholders((v) => !v)}
            className={accordionBtnClass}
          >
            <Users className="w-4 h-4 text-slate-500 shrink-0" aria-hidden />
            <span className="flex-1">{lang === 'cn' ? '利益相关方沙盘' : 'Stakeholder board'}</span>
            <ChevronDown
              className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${openStakeholders ? 'rotate-180' : ''}`}
            />
          </button>
          {openStakeholders && (
            <div className="px-6 pb-6 overflow-x-auto bg-white">
              <table className="w-full text-left text-xs border border-zinc-200 rounded-md overflow-hidden">
                <thead>
                  <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-600 font-mono uppercase text-[10px]">
                    <th className="p-3">{lang === 'cn' ? '主体' : 'Subject'}</th>
                    <th className="p-3">{lang === 'cn' ? '角色' : 'Role'}</th>
                    <th className="p-3">{lang === 'cn' ? '影响' : 'Impact'}</th>
                    <th className="p-3">{lang === 'cn' ? '勾连' : 'Anchor'}</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.stakeholders.map((row, i) => (
                    <tr key={i} className="border-b border-zinc-100 text-zinc-700">
                      <td className="p-3 align-top">{lang === 'cn' ? row.subject.cn : row.subject.en}</td>
                      <td className="p-3 align-top">{lang === 'cn' ? row.role.cn : row.role.en}</td>
                      <td className="p-3 align-top">{lang === 'cn' ? row.impact.cn : row.impact.en}</td>
                      <td className="p-3 align-top">{lang === 'cn' ? row.anchor.cn : row.anchor.en}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            type="button"
            onClick={() => setOpenVerify((v) => !v)}
            className={accordionBtnClass}
          >
            <ListChecks className="w-4 h-4 text-slate-500 shrink-0" aria-hidden />
            <span className="flex-1">{lang === 'cn' ? '可核验清单' : 'Verification checklist'}</span>
            <ChevronDown
              className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${openVerify ? 'rotate-180' : ''}`}
            />
          </button>
          {openVerify && (
            <ul className="px-6 pb-6 space-y-2 text-xs text-zinc-700 list-decimal pl-10 bg-white">
              {profile.verificationChecklist.map((v, i) => (
                <li key={i}>{lang === 'cn' ? v.item.cn : v.item.en}</li>
              ))}
            </ul>
          )}
        </>
      )}

      <footer className="px-6 py-3 border-t border-zinc-200 text-[9px] font-mono text-[var(--td-text-secondary)] bg-zinc-50 flex flex-wrap gap-x-4 gap-y-1">
        <span>model: {profile.audit.model}</span>
        <span>prompt: {profile.audit.promptVersion}</span>
        <span>{profile.audit.generatedAt}</span>
      </footer>
    </section>
  );
}
