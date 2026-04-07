import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getIsProForUser,
  subscriptionStatusIsPro,
} from '@/lib/billing-entitlements';

/** 供前端展示的终端配额快照（UTC 自然月） */
export interface TerminalQuotaPublic {
  /** 免费档月度上限；Pro 时与业务无关，可忽略 */
  limit: number;
  /** 本月已用（仅非 Pro 有意义） */
  used: number;
  /** 本月剩余次数（仅非 Pro） */
  remaining: number;
  /** 当前计费周期 YYYY-MM（UTC） */
  period: string;
  /** Pro 用户为 true，不计月度上限 */
  isUnlimited: boolean;
}

function currentUtcMonthKey(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  return `${y}-${m < 10 ? `0${m}` : String(m)}`;
}

/**
 * 读取环境变量中的免费用户月度终端配额上限，默认 3。
 */
export function getTerminalQuotaLimit(): number {
  const raw = process.env.TERMINAL_FREE_MONTHLY_LIMIT;
  if (raw === undefined || raw.trim() === '') {
    return 3;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    return 3;
  }
  return n;
}

/**
 * 基于 profiles 行计算当前用户的终端配额视图（读路径不写入数据库）。
 */
export async function getTerminalQuotaState(
  supabase: SupabaseClient,
  userId: string
): Promise<TerminalQuotaPublic> {
  const limit = getTerminalQuotaLimit();
  const period = currentUtcMonthKey();

  const { data, error } = await supabase
    .from('profiles')
    .select('subscription_status, terminal_quota_period, terminal_quota_used')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    // 无 profile 或查询失败时：保守按「免费全额剩余」处理
    return {
      limit,
      used: 0,
      remaining: limit,
      period,
      isUnlimited: false,
    };
  }

  const row = data as {
    subscription_status: string | null;
    terminal_quota_period: string | null;
    terminal_quota_used: number | null;
  };

  if (subscriptionStatusIsPro(row.subscription_status)) {
    return {
      limit: 0,
      used: 0,
      remaining: 0,
      period,
      isUnlimited: true,
    };
  }

  const usedEff =
    row.terminal_quota_period === period ? (row.terminal_quota_used ?? 0) : 0;
  const remaining = Math.max(0, limit - usedEff);

  return {
    limit,
    used: usedEff,
    remaining,
    period,
    isUnlimited: false,
  };
}

/**
 * 流式审讯开始前：非 Pro 且本月剩余为 0 则不允许发起。
 */
export async function assertCanStartTerminalStream(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  if (await getIsProForUser(supabase, userId)) {
    return true;
  }
  const state = await getTerminalQuotaState(supabase, userId);
  if (state.isUnlimited) {
    return true;
  }
  return state.remaining > 0;
}
