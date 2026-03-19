import { NextResponse } from 'next/server';
import { analyzeTextWithDeepSeek } from '@/services/deepseek';
import { supabaseAdmin } from '@/lib/supabase';
import { ApiResponse } from '@/types';
import { logger } from '@/utils/logger';
import crypto from 'crypto';

export async function POST(request: Request): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  try {
    const { content } = await request.json();
    logger.start('接收到前端 Decode 生成请求，文本载荷已获取');

    if (!content || typeof content !== 'string') {
      logger.crash('缺少情报文本或类型错误');
      return NextResponse.json({ success: false, error: '缺少情报文本' }, { status: 400 });
    }

    // 1. 调用底层大模型服务
    logger.async('调用 analyzeTextWithDeepSeek 神经引擎');
    const result = await analyzeTextWithDeepSeek(content);

    // 2. 生成全站唯一信号 ID
    const signalId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);

    // 3. 构建将要插入的强类型数据载荷
    const payload = {
      id: signalId,
      raw_content: content,
      fluff_words: result.fluffWords,
      hard_facts: result.hardFacts,
      verdict: result.verdict,
      view_count: 0
    };

    // 4. 写入 Supabase 永久数据库
    logger.async(`向 Supabase 写入分析资产, Signal: ${signalId}`);
    const { error: insertError } = await supabaseAdmin
      .from('signals')
      .insert([payload]);

    if (insertError) {
      throw new Error(`数据库底层写入异常: ${insertError.message}`);
    }

    logger.success(`报告已成功入库 Supabase, ID: ${signalId}`);

    // 5. 返回纯净 ID 给前端进行路由跳转
    return NextResponse.json({ success: true, data: { id: signalId } });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '引擎级联失效';
    logger.crash(`C端 API 路由网关阻断: ${errMsg}`);
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}