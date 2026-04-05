import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildIntelBriefMarkdown } from '@/lib/brief-markdown';
import { SignalRecord } from '@/types/database';

/**
 * 机构向 Markdown 简报：需登录；供复制进投委会材料或外部系统（非 PDF）。
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const lang = searchParams.get('lang') === 'en' ? 'en' : 'cn';

  const { data, error } = await supabase
    .from('signals')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  const markdown = buildIntelBriefMarkdown(data as SignalRecord, lang);

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  });
}
