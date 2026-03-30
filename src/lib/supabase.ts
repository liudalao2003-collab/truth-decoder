import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 🚀 架构师补强：单例模式，物理拦截重复实例化导致的警告
let supabaseInstance: any = null;

export const supabase = typeof window !== 'undefined' 
  ? (supabaseInstance || (supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey)))
  : createBrowserClient(supabaseUrl, supabaseAnonKey);

// 🔴 后端特权实例保持不变 
export const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : createClient(supabaseUrl, supabaseAnonKey);