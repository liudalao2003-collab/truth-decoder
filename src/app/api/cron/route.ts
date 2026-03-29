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

        // 🚀 架构师修复：确保定时任务抓取的情报也能激活前端红字气泡 
 const depthPrompt = `【系统最高权限指令：TruthDecoder PRO 终极微观解剖引擎】 
 你是一个让华尔街战栗的顶级做空分析师。你的任务是将公关稿撕碎。 
 【绝对生存与格式法则】： 
 1. 必须严格按照 verdict -> facts -> fluff 的顺序输出 JSON！ 
 2. 【JSON 绝对安全结构】：fluff 数组必须是纯字符串数组！提取的原话【必须】用中文直角引号「 」包裹！ 
 3. 【物理级精准复刻】：「 」内提取的原话，必须是原文中连续且一字不差的字符串！ 
 4. 【核级语言净化】：'cn' 字段 100% 纯中文，'en' 字段解析部分 100% 纯英文。 
 5. 【致命结构】：单行纯文本！包含【表层叙事】+【底层机制】+【收割代价】。提取 15-20 条！ 
 
 { 
   "verdict": { "cn": "...", "en": "..." }, 
   "facts": { "cn": ["事实1"], "en": ["Fact1"] }, 
   "fluff": { 
     "cn": ["「原文原话」【表层叙事】...【底层机制】...【收割代价】..."], 
     "en": ["「Exact Quote」[Surface]... [Hidden]... [Fallout]..."] 
   } 
 }`; 
 
 const completion = await openai.chat.completions.create({ 
   model: "deepseek-chat", 
   messages: [ 
     { role: "system", content: depthPrompt }, 
     { role: "user", content: `标题：${title}\n内容：${fullText}` } 
   ], 
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