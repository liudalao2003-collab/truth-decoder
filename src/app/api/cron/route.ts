import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import OpenAI from 'openai';

export const maxDuration = 60;

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    if (process.env.NODE_ENV === 'development') {
        console.log("🟢 [模块_发起] -> 自动巡航送报员敲门...");
    }
    
    const { data: configs } = await supabaseAdmin.from('system_configs').select('*');
    const configMap = configs?.reduce((acc: any, row: any) => ({ ...acc, [row.id]: row.value }), {}) || {};

    if (configMap.master_switch?.status === 'OFF') {
      return NextResponse.json({ success: false, message: 'Master Switch is OFF' });
    }

    const frequencyMinutes = configMap.scrape_frequency?.interval_minutes || 60;
    const lastRunTimeStr = configMap.cron_last_run?.time;

    if (lastRunTimeStr) {
      const lastRun = new Date(lastRunTimeStr).getTime();
      const now = new Date().getTime();
      const minutesPassed = (now - lastRun) / (1000 * 60);

      if (minutesPassed < (frequencyMinutes - 1)) {
        return NextResponse.json({ success: true, message: 'Clutch engaged' });
      }
    }

    await supabaseAdmin.from('system_configs').upsert({ 
      id: 'cron_last_run', 
      value: { time: new Date().toISOString() },
      updated_at: new Date().toISOString() 
    });

    const rawIntensity = configMap.scrape_intensity?.limit || 1;
    const intensity = Math.min(rawIntensity, 3); 
    const targetUrl = 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664';

    const rssRes = await fetch(targetUrl, { 
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows) Chrome/122.0.0.0 Safari/537.36' }
    });

    if (!rssRes.ok) throw new Error("RSS 接入失败");
    const rssText = await rssRes.text();
    const items = [...rssText.matchAll(/<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>/gi)].slice(0, intensity);
    
    let processedCount = 0;

    for (const item of items) {
      try {
        const title = item[1].replace(/<!\[CDATA\[|\]\]>/g, '');
        const link = item[2].trim();
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const articleRes = await fetch(`https://r.jina.ai/${link}`, {
          headers: { 'X-Return-Format': 'markdown' },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        let fullText = await articleRes.text();
        fullText = fullText.replace(/\[.*?\]\(.*?\)/g, '').replace(/!\[.*?\]/g, '').replace(/#+/g, '').replace(/\s+/g, ' ').substring(0, 3500);

        if (fullText.includes('SecurityCompromiseError') || fullText.includes('DDoS attack') || fullText.includes('Too many domains')) {
            continue;
        }

        if (fullText.length < 200) continue;

        // 🚀 核心升维：注入与 ingest 相同的极限要求
        const depthPrompt = `【系统最高权限指令：TruthDecoder PRO 终极微观解剖引擎】
你是一个让华尔街战栗的顶级做空分析师。你的任务是将公关稿撕碎。
【绝对生存与格式法则】：
1. 必须严格按照 verdict -> facts -> fluff 的顺序输出 JSON！
2. 【物理级精准复刻】：fluff 数组中提取的诱导词，必须是原文中【连续且一字不差】的字符串！绝对禁止概括或改写！
3. 【终极语言阉割】：'cn' 字段必须 100% 纯中文，严禁夹带任何英文字母，绝对禁止用括号标注英文原词！'en' 字段必须 100% 纯英文！
4. 【致命结构】：fluff 数组内的解析必须是单行纯文本！严禁换行！每条必须严格包含三个维度的显式前缀：【表层叙事】+【底层机制】+【收割代价】。提取 15-20 条！

{
  "verdict": { "cn": "一句极具张力的纯中文判决。", "en": "A ruthless, single-sentence pure English verdict." },
  "facts": { "cn": ["纯中文事实，提炼变更。"], "en": ["PURE ENGLISH facts ONLY."] },
  "fluff": {
    "cn": ["“原文一字不差的原话”：【表层叙事】全中文...；【底层机制】全中文...；【收割代价】全中文...。(🚨绝对单行纯文本！15-20条)"],
    "en": ["\"Exact substring\": [Surface Narrative] Pure English...; [Hidden Mechanism] Pure English...; [Harvesting Fallout] Pure English.... (🚨SINGLE LINE TEXT ONLY! 15-20 items)"]
  }
}`;

        const completion = await openai.chat.completions.create({
          model: "deepseek-chat",
          messages: [{ role: "system", content: depthPrompt }, { role: "user", content: `标题：${title}\n内容：${fullText}` }],
          response_format: { type: 'json_object' },
          temperature: 0.3
        });

        const rawAiOutput = completion.choices[0].message.content || '';
        let cleanedJsonString = rawAiOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
        const firstBrace = cleanedJsonString.indexOf('{');
        const lastBrace = cleanedJsonString.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
            cleanedJsonString = cleanedJsonString.substring(firstBrace, lastBrace + 1);
        }

        const intel = JSON.parse(cleanedJsonString);

        const { error: dbError } = await supabaseAdmin.from('signals').insert([{
          id: `SIGNAL_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          raw_content: `【标题】${title}\n\n【正文】\n${fullText}`,
          fluff_words: intel.fluff || { cn: [], en: [] }, 
          hard_facts: intel.facts || { cn: [], en: [] },
          verdict: intel.verdict?.cn || (intel.verdict || "解析失败"),
          view_count: 0,
          metadata: { source_url: link, bilingual: intel.verdict || {} } 
        }]);

        if (dbError) throw new Error(`DB Write Denied: ${dbError.message}`);

        processedCount++;
      } catch (e: any) {
        continue;
      }
    }

    return NextResponse.json({ success: true, processedCount });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}