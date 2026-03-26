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
          content: `你是一个拥有顶级认知的情报解码器。你的任务是撕开新闻通稿、官方宣发或宏观叙事的伪装，提取极其冷酷的真相。
请严格输出中英双语 JSON，必须保证数量和极度深度的剖析：
{
  "facts": {
    "cn": ["骨干事实1 (必须提取3-5条剥离修饰语的冰冷数据或核心政策底牌)", "骨干事实2", "骨干事实3"],
    "en": ["Hard fact 1 (MUST BE 100% PURE NATIVE ENGLISH, NO CHINESE)", "Hard fact 2", "Hard fact 3"]
  },
  "fluff": {
    "cn": ["隐秘动机1 (必须深度剖析3-5条！【禁止摘抄原文】请直接一针见血地指出：文章在掩盖什么风险？想诱导大众相信什么？)", "隐秘动机2", "隐秘动机3"],
    "en": ["Hidden motive 1 (MUST BE 100% PURE NATIVE ENGLISH, DIRECTLY EXPOSE THE HIDDEN AGENDA/RISK)", "Hidden motive 2", "Hidden motive 3"]
  },
  "verdict": {
    "cn": "【禁止说'作为分析师'等废话】用最辛辣、最精炼的一句话（不超过50字），直接点破这篇通稿背后真正的利益导向、资本运作逻辑或政治意图。",
    "en": "A ruthless, single-sentence verdict pointing out the true underlying agenda. (PURE ENGLISH ONLY)"
  }
}`
        },
        { role: "user", content: rawContent }
      ],
      response_format: { type: 'json_object' }
    });

    // 🛡️ 工业级 JSON 护盾：暴力清洗大模型可能的幻觉输出
    const rawAiOutput = completion.choices[0].message.content || '';

    // 1. 消除大小写不敏感的 markdown 标识 (追加 /i 标志，防备 ```JSON 或 ```Json 漏网)
    let cleanedJsonString = rawAiOutput.replace(/```json/gi, '').replace(/```/g, '').trim();

    // 2. 物理级剪裁：强制锁定 { 和 } 之间的核心内容，切除大模型可能生成的开头结尾废话
    const firstBrace = cleanedJsonString.indexOf('{');
    const lastBrace = cleanedJsonString.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
      cleanedJsonString = cleanedJsonString.substring(firstBrace, lastBrace + 1);
    }

    let intel;
    try {
      intel = JSON.parse(cleanedJsonString);
    } catch (parseError) {
      // 3. 绝境探针：如果 JSON.parse 依然失败，在后台抛出原生的畸形结构，便于排查
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

    // 🛡️ 底层兜底：万一并发导致预检穿透，被底层物理规则弹回
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