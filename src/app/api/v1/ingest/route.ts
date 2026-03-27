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
        return NextResponse.json({ success: false, error: 'Content is blocked by WAF.' }, { status: 423 });
    }

    const safeSnippet = rawContent.substring(0, 100).replace(/[%_]/g, '');
    const { data: existing } = await supabaseAdmin
      .from('signals')
      .select('id')
      .ilike('raw_content', `${safeSnippet}%`)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ success: true, data: { signalId: existing[0].id } });
    }

    const signalId = `SIGNAL_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    // 🚨 语言纯洁性最高指令注入 JSON 契约
    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `【系统最高权限指令：TruthDecoder PRO 终极智库引擎】
你是一个让华尔街战栗的顶级做空分析师。请扒开官方通稿的画皮。
请严格输出中英双语 JSON，【绝对禁止中英夹杂】：
{
  "facts": {
    "cn": ["纯中文事实，绝不夹带英文单词。"],
    "en": ["PURE ENGLISH facts ONLY. NO Chinese characters."]
  },
  "fluff": {
    "cn": ["“原文诱导词(中文)”：【表层叙事】...；【真实动作】...；【收割逻辑】...。(🚨必须是纯正中文！严禁在句中夹杂英文或使用括号保留原词！50-100字微观剖析，15-20条)"],
    "en": ["\"Translated Quote\": [Surface]...; [True Action]...; [Harvesting Logic].... (🚨ABSOLUTELY PURE ENGLISH! NO CHINESE CHARACTERS ALLOWED! 50-100 words micro-analysis, 15-20 items)"]
  },
  "verdict": {
    "cn": "一句极具张力的纯中文判决。",
    "en": "A ruthless, single-sentence pure English verdict."
  }
}`
        },
        { role: "user", content: rawContent }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6
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
        if (retry && retry.length > 0) return NextResponse.json({ success: true, data: { signalId: retry[0].id } });
        return NextResponse.json({ success: false, error: '底层力场拦截：该情报已存在。' });
      }
      throw dbError;
    }

    return NextResponse.json({ success: true, data: { signalId } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}