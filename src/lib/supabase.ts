import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 🟢 前端安全实例：必须使用 @supabase/ssr 的 createBrowserClient
// 它的超能力是：在客户端登录成功后，会自动将 Session 写入浏览器 Cookie，供云端中间件读取！
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

// 🔴 后端特权实例：供纯后端接口 (API Routes) 调用，直接使用 Service Role Key，不需要 Cookie
export const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : createClient(supabaseUrl, supabaseAnonKey);