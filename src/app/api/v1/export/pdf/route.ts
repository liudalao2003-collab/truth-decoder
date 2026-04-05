import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { buildIntelExportBlocks } from '@/lib/intel-export-sections';
import { renderIntelExportPdfBuffer } from '@/lib/intel-export-playwright-pdf';
import type { SignalRecord } from '@/types/database';

export const runtime = 'nodejs';

/** Playwright 冷启动 + 长文排版可能较慢 */
export const maxDuration = 120;

const bodySchema = z.object({
  id: z.string().min(1),
  lang: z.enum(['cn', 'en']),
  includeTerminal: z.boolean().optional(),
  terminalMessages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
      })
    )
    .optional(),
  dossierText: z.string().nullable().optional(),
});

/**
 * 登录用户整案 PDF：与长图同一套 HTML，经 Chromium 单页等高导出（中文折行与卡片一致）。
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON' },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid body' },
      { status: 400 }
    );
  }

  const { id, lang, includeTerminal, terminalMessages, dossierText } =
    parsed.data;

  const { data, error } = await supabase
    .from('signals')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { success: false, error: 'Not found' },
      { status: 404 }
    );
  }

  try {
    const blocks = buildIntelExportBlocks(data as SignalRecord, lang, {
      mode: 'full',
      dossierText: dossierText ?? undefined,
      includeTerminal: includeTerminal ?? false,
      terminalMessages: terminalMessages ?? [],
    });

    const buffer = await renderIntelExportPdfBuffer(blocks);

    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="TruthDecoder-${id}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e: unknown) {
    if (process.env.NODE_ENV === 'development') {
      const err = e instanceof Error ? e : new Error(String(e));
      console.log('🔴 [模块_崩溃] -> PDF 导出:', err.message);
    }
    return NextResponse.json(
      {
        success: false,
        error: 'PDF generation failed',
      },
      { status: 500 }
    );
  }
}
