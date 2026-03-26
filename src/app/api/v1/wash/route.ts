import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

export async function POST(req: Request) {
  try {
    // 1. 严格鉴权
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, rawContent } = await req.json();
    if (!id || !rawContent) throw new Error('Missing ID or Content');

    // 2. 挂载 V5.6 最新暗黑投行 Prompt 进行重铸 (增强英文约束)
    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { 
          role: "system", 
          content: `你是一个冷酷、极度敏锐的华尔街做空机构分析师。你的任务是撕开新闻稿的伪装，直击资本底牌。
          请将输入的商业通稿解码为中英双语的 JSON。
          
          输出结构严格如下：
          {
            "facts": { "cn": ["提取最核心的骨干事实", "..."], "en": ["Hard facts only (MUST BE 100% PURE NATIVE ENGLISH, NO CHINESE)", "..."] },
            "fluff": { "cn": ["分析对方刻意隐瞒的风险/隐秘动机/资本意图"], "en": ["Hidden agenda/Covered-up risks (PURE ENGLISH ONLY)"] },
            "verdict": { "cn": "用一句极度犀利的断言，总结这起事件的致命本质。", "en": "A ruthless, single-sentence verdict. (PURE ENGLISH ONLY)" }
          }`
        },
        { role: "user", content: rawContent }
      ],
      response_format: { type: 'json_object' }
    });

    const intel = JSON.parse(completion.choices[0].message.content || '{}');

    // 3. 🚨 物理覆盖：使用 .update() 而不是 .insert()，精准覆盖旧记录
    const { error: dbError } = await supabaseAdmin
      .from('signals')
      .update({
        fluff_words: intel.fluff, // 注入新的隐秘动机
        hard_facts: intel.facts,
        verdict: intel.verdict?.cn || "解析失败",
        metadata: { bilingual: intel.verdict, washed: true } // 打上清洗标记
      })
      .eq('id', id);

    if (dbError) throw dbError;
    return NextResponse.json({ success: true, message: `Signal ${id} Washed` });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}