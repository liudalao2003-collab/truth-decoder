import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 🟢 前端安全实例：供 Client Components 使用 (如登录页)，权限受 RLS 严格限制
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 🔴 后端特权实例：供 Node.js/Edge API 路由使用，绕过所有规则 (绝对禁止在 "use client" 中引入)
// 加一个容错判断，防止在没有配置环境变量的构建阶段报错
export const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : supabase;