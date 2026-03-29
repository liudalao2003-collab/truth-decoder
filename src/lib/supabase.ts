import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  if (process.env.NODE_ENV === 'development') {
    console.log('🔴 [模块_崩溃] -> 原因:', '环境变量 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY 物理级缺失');
  }
}

/**
 * 核心业务说明：建立全栈统一的持久化数据库连接实例。
 * 🚨 架构师红牌警告 (GOD-MODE LEAK PREVENTION)：
 * 此实例使用的是 Service Role Key，拥有最高管理员权限，无视所有 RLS 规则！
 * * 【物理隔离纪律】：
 * 1. 仅允许在 Python 爬虫数据写入网关 (Ingest) 使用。
 * 2. 仅允许在 Admin 中控台的特权配置修改 (Config) 使用。
 * 3. 仅允许在无用户的 Cron Job 中使用。
 * 🚨 绝对禁止在任何面向 C 端的路由中使用！
 */
export const supabaseAdmin = createClient(
  supabaseUrl || 'http://mock.supabase.co', 
  supabaseServiceKey || 'mock-key',
  {
    auth: {
      persistSession: false, 
    }
  }
);