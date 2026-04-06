import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 🚀 架构师补强：彻底抹除 any，通过 ReturnType 动态推导并锁定真实的客户端类型
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

export const supabase = typeof window !== 'undefined' 
  ? (supabaseInstance || (supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey)))
  : createBrowserClient(supabaseUrl, supabaseAnonKey);

// 🔴 后端特权实例保持不变
export const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : createClient(supabaseUrl, supabaseAnonKey);

/**
 * Webhook / billing 写 profiles 必须用服务角色，否则 RLS 会拒绝 upsert。
 * 缺失时抛错，由调用方返回 503，避免静默退回 anon 导致「Stripe 200 但库未更新」。
 */
export function getSupabaseServiceRoleOrThrow(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for billing writes');
  }
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
  }
  return createClient(supabaseUrl, key);
}