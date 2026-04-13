/**
 * 情报体征相关 metadata 工具：enrich(intel) 与异步 job runner 共用，避免双份漂移。
 */
export function isMetaRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

export function asBilingualData(x: unknown): { cn: string[]; en: string[] } {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return { cn: [], en: [] };
  const o = x as Record<string, unknown>;
  const cn = Array.isArray(o.cn) ? o.cn.filter((v): v is string => typeof v === 'string') : [];
  const en = Array.isArray(o.en) ? o.en.filter((v): v is string => typeof v === 'string') : [];
  return { cn, en };
}

/**
 * 判断是否需要重新生成情报体征（与 ingest enrich profile 逻辑一致）。
 */
export function needsIntelProfileRegeneration(meta: Record<string, unknown>): boolean {
  const profileObj = meta.intelProfile;
  const hasRealProfile =
    profileObj != null &&
    typeof profileObj === 'object' &&
    !String(
      ((profileObj as Record<string, unknown>).audit as Record<string, unknown>)?.promptVersion ?? ''
    ).includes('fallback');
  const hasError = meta.intelProfileError != null;
  return !hasRealProfile || hasError;
}
