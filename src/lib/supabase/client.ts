import { createBrowserClient } from '@supabase/ssr';

// 🚨 架构师 V6.9 终极防线：绝对单例模式 (Singleton)
// 物理锁定客户端实例，防止 React 疯狂重渲染导致内存爆炸
let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (browserClient) return browserClient;

  if (process.env.NODE_ENV === 'development') {
    console.log('🟢 [模块_发起] -> 动作/参数:', '初始化物理级唯一 Browser Supabase 客户端');
  }
  
  browserClient = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return browserClient;
}