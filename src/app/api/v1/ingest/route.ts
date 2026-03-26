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

    const { rawContent } = await req.json();
    if (!rawContent) throw new Error('Empty content');

    if (rawContent.includes('SecurityCompromiseError') || rawContent.includes('DDoS attack') || rawContent.includes('Too many domains')) {
        console.warn("⚠️ 踩中 WAF 毒饵，判定为爬虫拦截，丢弃此条。");
        return NextResponse.json({ success: false, error: 'Content is blocked by WAF.' }, { status: 423 });
    }

    const safeSnippet = rawContent.substring(0, 100).replace(/[%_]/g, '');
    const { data: existing } = await supabaseAdmin
      .from('signals')
      .select('id')
      .ilike('raw_content', `${safeSnippet}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`[前置拦截] 资产已存在，引导至: ${existing[0].id}`);
      return NextResponse.json({ success: true, data: { signalId: existing[0].id } });
    }

    const signalId = `SIGNAL_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `你是一个拥有顶级认知的情报解码器。你的任务是撕开新闻通稿、官方宣发或宏观叙事的伪装，提取极其冷酷的真相。
请严格输出中英双语 JSON，必须保证数量和极度深度的剖析：
{
  "facts": {
    "cn": ["骨干事实1", "骨干事实2", "骨干事实3"],
    "en": ["Hard fact 1", "Hard fact 2", "Hard fact 3"]
  },
  "fluff": {
    "cn": ["“原文中具体的一句话或核心词汇(至少4个字)”：这背后的真正动机是...(必须深度剖析！至少提取 6-8 条致命隐患！)", "“原话2”：剖析2"],
    "en": ["\"Exact quote from text\": The hidden motive is... (EXTRACT 6-8 ITEMS, PURE ENGLISH)", "\"Quote 2\": Analysis 2"]
  },
  "verdict": {
    "cn": "【禁止说'作为分析师'等废话】用最辛辣、最精炼的一句话，点破背后的利益导向。",
    "en": "A ruthless, single-sentence verdict. (PURE ENGLISH ONLY)"
  }
}`
        },
        { role: "user", content: rawContent }
      ],
      response_format: { type: 'json_object' }
    });

    const rawAiOutput = completion.choices[0].message.content || '';
    let cleanedJsonString = rawAiOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
    const firstBrace = cleanedJsonString.indexOf('{');
    const lastBrace = cleanedJsonString.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
      cleanedJsonString = cleanedJsonString.substring(firstBrace, lastBrace + 1);
    }

    let intel;
    try {
      intel = JSON.parse(cleanedJsonString);
    } catch (parseError) {
      if (process.env.NODE_ENV === 'development') {
         console.log("🔴 [模块_崩溃] -> 大模型吐出的畸形数据:", rawAiOutput);
      }
      throw new Error("AI 引擎发生逻辑混乱，无法格式化输出，请重试。");
    }

    const { error: dbError } = await supabaseAdmin
      .from('signals')
      .insert([{
        id: signalId,
        raw_content: rawContent,
        fluff_words: intel.fluff || { cn: [], en: [] },
        hard_facts: intel.facts || { cn: [], en: [] },
        verdict: intel.verdict?.cn || "解析失败",
        metadata: { bilingual: intel.verdict || {} }
      }]);

    if (dbError) {
      if (dbError.code === '23505') {
        const { data: retry } = await supabaseAdmin.from('signals').select('id').ilike('raw_content', `${safeSnippet}%`).limit(1);
        if (retry && retry.length > 0) {
            return NextResponse.json({ success: true, data: { signalId: retry[0].id } });
        }
        return NextResponse.json({ success: false, error: '底层力场拦截：该情报已存在，但无法定位，请刷新列表。' });
      }
      throw dbError;
    }

    return NextResponse.json({ success: true, data: { signalId } });

  } catch (error: any) {
    console.error("[INGEST_API_ERROR]", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}