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
      messages: [
        { 
          role: "system", 
          content: `【系统最高权限指令：TruthDecoder PRO 终极智库引擎】
你是一个让华尔街战栗的顶级做空分析师。
请将输入的商业通稿解码为中英双语的 JSON，【绝对禁止中英夹杂】：
{
  "facts": { "cn": ["纯中文事实，绝不夹杂英文"], "en": ["PURE ENGLISH facts ONLY"] },
  "fluff": { 
    "cn": ["“原文具体诱导词”：【表层叙事】...；【真实动作】...；【收割逻辑】...。(🚨必须是纯正中文！严禁在句中夹杂英文或用括号保留原词！50-100字，15-20条)"], 
    "en": ["\"Translated Quote\": [Surface]...; [True Action]...; [Harvesting Logic].... (🚨ABSOLUTELY PURE ENGLISH! NO CHINESE CHARACTERS! 50-100 words, 15-20 items)"] 
  },
  "verdict": { "cn": "一句纯中文的犀利判决。", "en": "A ruthless, single-sentence pure English verdict." }
}`
        },
        { role: "user", content: rawContent }
      ],
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}