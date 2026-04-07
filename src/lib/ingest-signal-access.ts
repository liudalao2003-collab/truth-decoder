import type { IngestAuthOk } from '@/lib/ingest-auth';

/**
 * 判断调用方是否有权对某条 signal 执行入库后补全（enrich）。
 * - 服务令牌：始终允许（爬虫 / 脚本）。
 * - 登录用户：仅允许本人 owner 的记录；owner 为空的历史数据允许任意已登录用户补全（避免旧数据永不可修复）。
 */
export function canEnrichSignal(
  auth: IngestAuthOk,
  row: { owner_id?: string | null }
): boolean {
  if (auth.kind === 'service') return true;
  if (auth.kind === 'user') {
    if (row.owner_id == null || row.owner_id === '') return true;
    return row.owner_id === auth.userId;
  }
  return false;
}
