import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, rawContent } = await req.json();
    if (!id || !rawContent) throw new Error('Missing ID or Content');

    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "system", content: `【系统最高权限指令：TruthDecoder PRO 终极智库引擎】...` }, { role: "user", content: rawContent }],
      response_format: { type: 'json_object' },
      temperature: 0.6
    });

    const intel = JSON.parse(completion.choices[0].message.content || '{}');

    const { error: dbError } = await supabaseAdmin
      .from('signals')
      .update({
        fluff_words: intel.fluff,
        hard_facts: intel.facts,
        verdict: intel.verdict?.cn || "解析失败",
        metadata: { bilingual: intel.verdict, washed: true }
      })
      .eq('id', id);

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, message: `Signal ${id} Washed` });
  } catch (error: unknown) {
    // 🚀 核心修复：收割所有潜在异常
    const errMsg = error instanceof Error ? error.message : '资产重塑过程遭遇致命死锁';
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}