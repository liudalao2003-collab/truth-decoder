import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔴 [模块_崩溃] -> 原因: 环境变量 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 物理级缺失');
  }
}

/**
 * 核心业务说明：建立全栈统一的持久化数据库连接实例。
 * 🚨 严禁在客户端组件 (use client) 中直接导入此文件，因为 service_role 具有绕过 RLS 的最高读写权限。
 * 它只允许在 API Routes 或 Server Components 中被唤醒。
 */
export const supabaseAdmin = createClient(
  supabaseUrl || 'http://mock.supabase.co', 
  supabaseServiceKey || 'mock-key',
  {
    auth: {
      persistSession: false, // 后端环境不需要维持用户 session
    }
  }
);