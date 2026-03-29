import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// 🚨 架构师排雷：强制移除 export const runtime = 'edge'; 
// 回归 Node.js 物理机环境，确保能承载万字级双语 JSONB 载荷而不超时崩溃

/**
 * 核心业务说明：
 * 静默持久化探针 (Silent Sync Gateway)。
 * 专门用于接收前端的 Lazy-Translate 和初次生成的缓存回写请求。
 */
export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('🟢 [模块_发起] -> 动作/参数: 接收双轨卷宗静默同步请求 (Node.js 引擎)');
    }

    // 1. 物理级鉴权防线
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔴 [模块_崩溃] -> 原因: 静默同步网关越权访问被拦截 (Unauthorized)');
      }
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 2. 载荷解析与校验 (解开体积极限)
    const { id, dossier_content } = await req.json();

    if (!id || !dossier_content) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔴 [模块_崩溃] -> 原因: 载荷残缺，缺少 id 或 dossier_content');
      }
      return NextResponse.json({ success: false, error: 'Invalid Payload' }, { status: 400 });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`🟡 [模块_异步] -> 目标: 覆写 Supabase 数据库 (Signal ID: ${id})，载荷尺寸探测正常`);
    }

    // 3. 🔪 执行底层数据覆写为双语 JSONB
    const { error } = await supabaseAdmin
      .from('signals')
      .update({ dossier_content })
      .eq('id', id);

    if (error) throw error; // 强行抛出让 Catch 块捕获

    if (process.env.NODE_ENV === 'development') {
      console.log(`🔵 [模块_成功] -> 产物: 卷宗双轨数据持久化完成！`);
    }

    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    // 🚨 架构师防线：彻底撕裂黑盒。无视 JS 类型，强行序列化未知错误对象
    const errorDetails = err?.message || err?.details || JSON.stringify(err);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('\n🔴 [模块_崩溃] -> 真实死因已锁定:');
      console.log(errorDetails);
      console.log('----------------------------------------\n');
    }
    
    return NextResponse.json({ success: false, error: errorDetails }, { status: 500 });
  }
}