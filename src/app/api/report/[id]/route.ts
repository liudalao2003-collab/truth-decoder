import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { ApiResponse, DecodeResult } from '@/types';

export interface ReportPayload {
  rawContent: string;
  result: DecodeResult;
  viewCount?: number;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<ReportPayload>>> {
  try {
    const resolvedParams = await params;
    const signalId = resolvedParams.id;
    
    // 强制统一前缀寻找
    const redisKey = `truth_decoder:signal:${signalId}`;
    console.log(`🟡 [网络请求] -> 接口: /api/report, 寻找隔离 Key: ${redisKey}`);

    // 1. 获取数据
    const payload = await redis.get<ReportPayload>(redisKey);

    if (!payload) {
      console.log(`🔴 [错误捕获] -> 节点: Redis 查无此记录: ${redisKey}`);
      return NextResponse.json({ success: false, error: '报告不存在或已过期' }, { status: 404 });
    }

    // 2. 计次更新
    const updatedCount = (payload.viewCount || 0) + 1;
    await redis.set(redisKey, { ...payload, viewCount: updatedCount }, { keepTtl: true });

    return NextResponse.json({ 
      success: true, 
      data: { ...payload, viewCount: updatedCount } 
    });

  } catch (error: unknown) {
    console.log('🔴 [错误捕获] -> 节点: Report 获取失败', error);
    return NextResponse.json({ success: false, error: '数据库连接异常' }, { status: 500 });
  }
}