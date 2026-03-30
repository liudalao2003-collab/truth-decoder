import { createClient } from '@supabase/supabase-js';
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