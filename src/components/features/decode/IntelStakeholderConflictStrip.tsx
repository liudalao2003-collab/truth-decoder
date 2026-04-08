'use client';

import { ArrowRight, GitBranch } from 'lucide-react';
import type { IntelProfile } from '@/types/intel-profile';

interface IntelStakeholderConflictStripProps {
  profile: IntelProfile;
  lang: 'cn' | 'en';
}

/**
 * 利益相关方「冲突链」横滑条：用现有沙盘行数据做视觉主轴，无新增 API。
 */
export default function IntelStakeholderConflictStrip({
  profile,
  lang,
}: IntelStakeholderConflictStripProps) {
  const rows = profile.stakeholders.slice(0, 5);

  return (
    <div className="mb-4 px-1">
      <div className="flex items-center gap-2 mb-2 text-[10px] font-mono uppercase tracking-widest text-slate-600">
        <GitBranch className="w-3.5 h-3.5 text-slate-500" aria-hidden />
        {lang === 'cn' ? '冲突主轴（主体链路）' : 'Conflict chain (actors)'}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-300">
        {rows.map((row, i) => {
          const title = lang === 'cn' ? row.subject.cn : row.subject.en;
          const role = lang === 'cn' ? row.role.cn : row.role.en;
          return (
            <div key={i} className="flex items-stretch shrink-0 gap-2">
              <div className="w-[min(200px,72vw)] rounded-lg border border-slate-200 bg-white p-3 shadow-sm ring-1 ring-slate-100">
                <p className="text-[11px] font-semibold text-zinc-900 leading-snug line-clamp-2">{title}</p>
                <p className="text-[10px] text-zinc-600 mt-1.5 line-clamp-3">{role}</p>
              </div>
              {i < rows.length - 1 && (
                <div className="flex items-center text-slate-400 shrink-0">
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
