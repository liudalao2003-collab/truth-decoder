import { NextResponse } from 'next/server';
import { analyzeTextWithDeepSeek } from '@/services/deepseek';
import { ApiResponse, DecodeResult } from '@/types';

// 强制声明 Edge 运行时。由于不涉及 Redis 连接，Edge Runtime 能提供极低延迟的全球分布响应
export const runtime = 'edge';

// 严格的 TS 纯洁性：定义 B 端请求的载荷契约
interface BSideDecodeRequest {
  content: string;
}

export async function POST(request: Request): Promise<NextResponse<ApiResponse<DecodeResult>>> {
  try {
    console.log('🟢 [状态发起] -> 变量: B端网关接收到外部直连请求');

    // 1. 物理级鉴权防线 (商业化闸机核心)
    // 业务说明：拦截一切白嫖请求。B端客户必须在 HTTP Header 中携带我们分发的凭证
    const authHeader = request.headers.get('authorization');
    const expectedKey = process.env.B_SIDE_API_KEY;

    if (!expectedKey) {
      console.log('🔴 [错误捕获] -> 节点: B端网关 - 系统未配置商业化主密钥 (B_SIDE_API_KEY)');
      return NextResponse.json({ success: false, error: '商业化网关暂未激活，请联系商务' }, { status: 503 });
    }

    if (authHeader !== `Bearer ${expectedKey}`) {
      console.log('🔴 [错误捕获] -> 节点: B端网关 - 越权访问尝试已被拦截');
      return NextResponse.json({ success: false, error: '未经授权的调用凭证 (Invalid API Key)' }, { status: 401 });
    }

    // 2. 载荷解析与 TS 类型断言
    const body = await request.json();
    const { content } = body as BSideDecodeRequest;

    if (!content || typeof content !== 'string') {
      console.log('🔴 [错误捕获] -> 节点: B端网关 - 客户入参非法');
      return NextResponse.json({ success: false, error: '缺少有效的情报文本 (字段名需为 content)' }, { status: 400 });
    }

    console.log(`🟡 [网络请求] -> 接口: 调度底层 DeepSeek 引擎, 文本长度: ${content.length}`);

    // 3. 核心解耦：直接调度底层分析服务
    // 业务说明：直接拿到纯净的 DecodeResult，彻底绕开 C 端的 Redis 存储与 Signal ID 逻辑
    const result = await analyzeTextWithDeepSeek(content);

    console.log('🔵 [数据渲染] -> 组件: B端网关成功向外泵出高净值 JSON 资产');

    // 4. 纯净输出给 B 端调用者
    return NextResponse.json({ success: true, data: result });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'B端网关级联失效';
    console.log('🔴 [错误捕获] -> 节点: B端 API 商业化网关', errMsg);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}