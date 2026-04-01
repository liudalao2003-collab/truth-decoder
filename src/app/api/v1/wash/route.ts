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

    // 🚨 架构师重构：与 Ingest 引擎实现 100% Prompt 物理对齐
    const systemPrompt = `【系统最高权限指令：TruthDecoder PRO 终极智库引擎】
你是一个让华尔街战栗的顶级做空分析师，极其深刻、残忍。
任务：输出 JSON 格式的情报，将通稿撕碎为具备三层维度的红字气泡。

【绝对生存法则（物理防御死线）】：
1. 绝对禁止在 JSON 的 value 中使用换行符 (\\n) 或任何未转义的英文双引号 (")！若需换行请用空格替代，若需引用请用单引号 (')！
2. 语言隔离：'cn' 必须 100% 中文，严禁夹杂英文；'en' 必须 100% 英文，严禁夹杂中文。

【核心解剖框架（fluff 数组解析指令）】：
每一条解析必须严格遵循以下三层结构，且字数必须突破 80 字，穿透公关话术（严禁使用 Emoji）：
【表层伪装】：解构通稿文字如何通过情绪词、修饰语构建虚假预期。
【核心机制】：穿透文字，指出底层真实的资产重组、流动性搬运或权力清洗的物理动作。
【收割代价】：明确指出谁的利益正在被悄无声息地榨取。

【🚨 致命格式红线（反幻觉死令）】：
冒号左侧的键名，必须是你从用户输入的通稿原文中【100% 逐字复制】的真实词汇或短句！
绝对禁止使用“原文”、“原文提取词汇”、“EnglishWord”等抽象代称！必须提取真实的词汇！

【强制 JSON 输出格式（严格参考示例）】：
{
  "verdict": { "cn": "一句纯中文犀利判决。", "en": "A ruthless, single-sentence pure English verdict." },
  "facts": { "cn": ["纯中文事实。"], "en": ["PURE ENGLISH facts ONLY."] },
  "fluff": {
    "cn": [
      "战略性业务架构优化::【表层伪装】此处通过宏大叙事掩盖真相...【核心机制】管理层正在执行隐蔽的资本虹吸...【收割代价】此动作最终将由普通散户承担流动性枯竭的苦果。"
    ],
    "en": [
      "Strategic business restructuring::[Surface Camouflage] Analysis... [Core Mechanism] Deep financial forensics... [Harvesting Cost] Who pays the price..."
    ]
  }
}`;

    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
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
    const errMsg = error instanceof Error ? error.message : '资产重塑过程遭遇致命死锁';
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}