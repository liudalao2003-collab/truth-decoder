import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

/**
 * 核心业务：全量资产红利重铸引擎 (V5.7 工业级)
 * 变更：移除 Emoji，强制深度解构，确保 100% 语言纯洁。
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, rawContent } = await req.json();
    if (!id || !rawContent) throw new Error('Missing ID or Content');

    const systemPrompt = `【系统最高权限指令：TruthDecoder PRO 终极智库重塑引擎】
你是一个让华尔街战栗的顶级做空分析师。任务：将通稿重塑为 JSON 格式的深层情报。

【绝对指令】：
1. 严禁使用任何 Emoji 符号（如 🎭, ⚙️, 🗡️）。
2. 解析字数下限 100 字，必须包含 [表层伪装]、[核心机制]、[收割代价] 三大维度。
3. 语言隔离：'cn' 字段严禁出现英文，'en' 字段严禁出现中文。
4. 深度法则：利用杜邦分析、博弈论或 MECE 原则进行解构，禁止空洞描述。
5. 唯一性：fluff 键名必须唯一，且必须是原文提取。

{
  "verdict": { "cn": "...", "en": "..." },
  "facts": { "cn": ["..."], "en": ["..."] },
  "fluff": {
    "cn": ["原文词::[表层伪装]...[核心机制]...[收割代价]..."],
    "en": ["Term::[SurfaceCamouflage]...[CoreMechanism]...[HarvestingCost]..."]
  }
}`;

    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: rawContent }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const intel = JSON.parse(completion.choices[0].message.content || '{}');

    const { error: dbError } = await supabaseAdmin
      .from('signals')
      .update({
        fluff_words: intel.fluff,
        hard_facts: intel.facts,
        verdict: intel.verdict?.cn || "解析失败",
        metadata: { bilingual: intel.verdict, washed: true, model: 'deepseek-v3' }
      })
      .eq('id', id);

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, message: `Signal ${id} Washed & Upgraded` });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '资产重塑过程遭遇致命死锁';
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}