import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ApiResponse, DecodeResult } from '@/types';
import { SignalRecord } from '@/types/database';
import type { IntelProfile, IntelProfileError } from '@/types/intel-profile';
import { logger } from '@/utils/logger';

export interface ReportPayload {
  rawContent: string;
  result: DecodeResult;
  viewCount?: number;
  intelProfile?: IntelProfile | null;
  intelProfileError?: IntelProfileError | null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<ReportPayload>>> {
  try {
    const resolvedParams = await params;
    const signalId = resolvedParams.id;
    
    logger.start(`发起 Report 获取请求, Signal ID: ${signalId}`);
    logger.async(`查询 Supabase 数据库: ${signalId}`);

    // 1. 从 Supabase 获取数据
    const { data: record, error: fetchError } = await supabaseAdmin
      .from('signals')
      .select('*')
      .eq('id', signalId)
      .single<SignalRecord>();

    if (fetchError || !record) {
      logger.crash(`Supabase 查无此记录或查询失败: ${fetchError?.message || 'Not Found'}`);
      return NextResponse.json({ success: false, error: '报告不存在或信号已被抹除' }, { status: 404 });
    }

    // 2. 计算新的浏览量
    const updatedCount = (record.view_count || 0) + 1;

    // 3. 异步更新浏览量 (非阻塞式更新，不等待其完成即可返回响应，压榨性能)
    supabaseAdmin
      .from('signals')
      .update({ view_count: updatedCount })
      .eq('id', signalId)
      .then(({ error }) => {
        if (error && process.env.NODE_ENV === 'development') {
          console.log(`🔴 [模块_崩溃] -> 异步更新 view_count 失败:`, error.message);
        }
      });

    logger.success(`Report 提取成功，当前 View: ${updatedCount}`);

    // 4. 重组为前端严格期望的契约类型
    const payload: ReportPayload = {
      rawContent: record.raw_content,
      result: {
        fluffWords: record.fluff_words,
        hardFacts: record.hard_facts,
        verdict: record.verdict,
      },
      viewCount: updatedCount,
      intelProfile: record.metadata?.intelProfile ?? null,
      intelProfileError: record.metadata?.intelProfileError ?? null,
    };

    return NextResponse.json({ 
      success: true, 
      data: payload
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '数据库连接异常';
    logger.crash(`Report 获取链路崩塌: ${errMsg}`);
    return NextResponse.json({ success: false, error: '深层数据提取异常' }, { status: 500 });
  }
}