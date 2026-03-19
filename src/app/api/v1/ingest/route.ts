import { NextResponse } from 'next/server';
import { analyzeTextWithDeepSeek } from '@/services/deepseek';
import { supabaseAdmin } from '@/lib/supabase';
import { ApiResponse } from '@/types';
import { logger } from '@/utils/logger';
import crypto from 'crypto';

// 严格的 TS 纯洁性：定义注入网关请求的载荷契约
interface IngestRequest {
  rawContent: string;
}

/**
 * 核心业务说明：
 * 这是 TruthDecoder 面向自动化爬虫的专属高权限注入网关。
 * 它负责接收外部脚本抓取的原始通稿，驱动底层博弈引擎，并直接将最终的高净值情报强制写入数据库。
 */
export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ signalId: string }>>> {
  try {
    logger.start('内部高权限情报注入网关被唤醒');

    // 1. 物理级鉴权防线 (Anti-Leak)
    // 业务说明：严禁任何未经授权的外部节点向我们的系统注入脏数据
    const authHeader = request.headers.get('authorization');
    const expectedKey = process.env.INTERNAL_INGEST_KEY;

    if (!expectedKey) {
      logger.crash('内部注入网关缺失主密钥 (INTERNAL_INGEST_KEY)');
      return NextResponse.json({ success: false, error: '注入网关未配置' }, { status: 503 });
    }

    if (authHeader !== `Bearer ${expectedKey}`) {
      logger.crash('越权注入尝试已被物理拦截');
      return NextResponse.json({ success: false, error: '非法注入凭证 (Invalid Token)' }, { status: 401 });
    }

    // 2. 载荷解析与 TS 类型断言
    const body = await request.json();
    const { rawContent } = body as IngestRequest;

    if (!rawContent || typeof rawContent !== 'string') {
      logger.crash('注入载荷非法：缺少 rawContent');
      return NextResponse.json({ success: false, error: '缺少有效的文本通稿' }, { status: 400 });
    }

    logger.async(`调度神经引擎进行深度洗稿, 文本长度: ${rawContent.length}`);

    // 3. 核心解耦：直接调度底层的 DeepSeek 引擎进行博弈分析
    const result = await analyzeTextWithDeepSeek(rawContent);

    // 4. 生成全站唯一信号 ID
    const signalId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);

    // 5. 构建将要插入的强类型数据载荷
    const payload = {
      id: signalId,
      raw_content: rawContent,
      fluff_words: result.fluffWords,
      hard_facts: result.hardFacts,
      verdict: result.verdict,
      view_count: 0
    };

    logger.async(`向 Supabase 写入高净值情报资产, Signal: ${signalId}`);

    // 6. 写入 Supabase 永久数据库
    const { error: insertError } = await supabaseAdmin
      .from('signals')
      .insert([payload]);

    if (insertError) {
      throw new Error(`数据库底层写入异常: ${insertError.message}`);
    }

    logger.success(`自动化情报已成功入库, Signal ID: ${signalId}`);

    // 7. 纯净输出给 Python 爬虫，完成业务闭环
    return NextResponse.json({ success: true, data: { signalId } });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '注入网关级联失效';
    logger.crash(`自动化注入链路崩塌: ${errMsg}`);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}