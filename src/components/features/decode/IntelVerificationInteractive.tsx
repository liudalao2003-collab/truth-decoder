'use client';

import { useCallback, useEffect, useState } from 'react';
import { StickyNote } from 'lucide-react';
import type { IntelProfile } from '@/types/intel-profile';

const STORAGE_VER = 'v1';

function keyCheck(signalId: string) {
  return `td_intel_${STORAGE_VER}_chk_${signalId}`;
}

function keyNote(signalId: string) {
  return `td_intel_${STORAGE_VER}_note_${signalId}`;
}

interface IntelVerificationInteractiveProps {
  profile: IntelProfile;
  lang: 'cn' | 'en';
  signalId: string;
}

/**
 * 可核验清单：本地勾选进度 + 我的研判笔记（localStorage），增强回访粘性。
 */
export default function IntelVerificationInteractive({
  profile,
  lang,
  signalId,
}: IntelVerificationInteractiveProps) {
  const n = profile.verificationChecklist.length;
  const [checked, setChecked] = useState<boolean[]>(() => Array(n).fill(false));
  const [note, setNote] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(keyCheck(signalId));
      if (raw) {
        const parsed = JSON.parse(raw) as boolean[];
        if (Array.isArray(parsed) && parsed.length === n) {
          setChecked(parsed);
        }
      }
      const nRaw = localStorage.getItem(keyNote(signalId));
      if (nRaw) setNote(nRaw);
    } catch {
      /* 忽略坏数据 */
    }
    setHydrated(true);
  }, [signalId, n]);

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    try {
      localStorage.setItem(keyCheck(signalId), JSON.stringify(checked));
    } catch {
      /* 存储满等 */
    }
  }, [checked, hydrated, signalId]);

  const persistNote = useCallback(
    (value: string) => {
      setNote(value);
      if (typeof window === 'undefined') return;
      try {
        localStorage.setItem(keyNote(signalId), value);
      } catch {
        /* ignore */
      }
    },
    [signalId]
  );

  const doneCount = checked.filter(Boolean).length;

  return (
    <div className="space-y-4">
      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
        {lang === 'cn'
          ? `核验进度 ${doneCount}/${n}（仅本机保存）`
          : `Check progress ${doneCount}/${n} (saved locally)`}
      </p>
      <ul className="space-y-3 text-xs text-zinc-800">
        {profile.verificationChecklist.map((v, i) => (
          <li key={i} className="flex gap-3 items-start">
            <input
              type="checkbox"
              id={`intel-verify-${signalId}-${i}`}
              checked={checked[i] ?? false}
              onChange={(e) => {
                const next = [...checked];
                next[i] = e.target.checked;
                setChecked(next);
              }}
              className="mt-1 h-4 w-4 rounded border-zinc-300 text-red-600 focus:ring-red-500"
            />
            <label
              htmlFor={`intel-verify-${signalId}-${i}`}
              className={`leading-relaxed cursor-pointer ${checked[i] ? 'text-zinc-500 line-through' : ''}`}
            >
              {lang === 'cn' ? v.item.cn : v.item.en}
            </label>
          </li>
        ))}
      </ul>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-3">
        <label
          htmlFor={`intel-note-${signalId}`}
          className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-zinc-600 mb-2"
        >
          <StickyNote className="w-3.5 h-3.5" aria-hidden />
          {lang === 'cn' ? '我的研判笔记' : 'My notes'}
        </label>
        <textarea
          id={`intel-note-${signalId}`}
          value={note}
          onChange={(e) => persistNote(e.target.value)}
          rows={3}
          placeholder={
            lang === 'cn'
              ? '查证结果、存疑点、下次回访要看的线索…（仅存本机浏览器）'
              : 'Verification results, open questions… (stored in this browser only)'
          }
          className="w-full text-xs text-zinc-800 bg-white border border-zinc-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-200 resize-y min-h-[72px]"
        />
      </div>
    </div>
  );
}
