import { NextResponse } from 'next/server';
import { analyzeTextWithDeepSeek } from '@/services/deepseek';
import { redis } from '@/lib/redis';
import { ApiResponse } from '@/types';
import crypto from 'crypto';

export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  try {
    const { content } = await request.json();
    console.log('🟢 [状态发起] -> 变量: 接收到前端 Decode 生成请求');

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ success: false, error: '缺少情报文本' }, { status: 400 });
    }

    // 1. 调用底层大模型服务
    const result = await analyzeTextWithDeepSeek(content);

    // 2. 生成全站唯一信号 ID
    const signalId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);

    // 3. 强制统一前缀
    const redisKey = `truth_decoder:signal:${signalId}`;
    
    // 初始化时直接加入 viewCount: 0
    const payload = { rawContent: content, result, viewCount: 0 };
    
    // 写入 Redis (设置 24 小时过期)
    await redis.set(redisKey, payload, { ex: 86400 });

    console.log(`🔵 [数据写入] -> 组件: 报告已入库 Redis, 隔离 Key: ${redisKey}`);

    // 4. 返回纯净 ID
    return NextResponse.json({ success: true, data: { id: signalId } });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '引擎级联失效';
    console.log('🔴 [错误捕获] -> 节点: B端 API 路由网关', errMsg);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}