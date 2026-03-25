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

    // 🧹 毒饵拦截：如果 Jina 被墙，立刻丢弃本篇
    if (rawContent.includes('SecurityCompromiseError') || rawContent.includes('DDoS attack') || rawContent.includes('Too many domains')) {
        console.warn("⚠️ 踩中 WAF 毒饵，判定为爬虫拦截，丢弃此条。");
        return NextResponse.json({ success: false, error: 'Content is blocked by WAF.' }, { status: 423 });
    }

    // 🛡️ 穹顶预检：提取前 100 个字符进行匹配 (避开完整长文本可能导致的 GET URL 长度超限问题)
    const safeSnippet = rawContent.substring(0, 100).replace(/[%_]/g, '');
    const { data: existing } = await supabaseAdmin
      .from('signals')
      .select('id')
      .ilike('raw_content', `${safeSnippet}%`)
      .limit(1);

    // 🚀 如果库里已经有了，直接返回现有 ID，让前端“秒切”过去，不消耗任何 Token
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
          content: "你是一个冷酷的华尔街做空分析师。请将通稿解码为中英双语 JSON：\n{\n  \"facts\": { \"cn\":[], \"en\":[] },\n  \"fluff\": { \"cn\":[], \"en\":[] },\n  \"verdict\": { \"cn\":\"\", \"en\":\"\" }\n}"
        },
        { role: "user", content: rawContent }
      ],
      response_format: { type: 'json_object' }
    });

    // 🛡️ 强制剥离大模型可能附带的 Markdown 代码块残留
    const rawAiOutput = completion.choices[0].message.content || ''
    const cleanedJsonString = rawAiOutput.replace(/```json/g, '').replace(/```/g, '').trim();
    
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

    // 🛡️ 底层兜底：万一并发导致预检穿透，被底层物理规则弹回
    if (dbError) {
      if (dbError.code === '23505') {
        // 顺势查出现有 ID 并返回，优雅地化解崩溃
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