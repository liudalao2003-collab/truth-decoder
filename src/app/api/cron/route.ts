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

        const depthPrompt = `你是一个拥有顶级认知的情报解码器。你的任务是撕开新闻通稿的伪装，提取真相。请严格输出中英双语 JSON：{"facts": {"cn": ["事实1"], "en": ["Fact 1 (PURE ENGLISH ONLY)"]}, "fluff": {"cn": ["隐秘动机1"], "en": ["Fluff 1 (PURE ENGLISH ONLY)"]}, "verdict": {"cn": "一句话点评", "en": "Single sentence verdict (PURE ENGLISH ONLY)"}}`;

        const completion = await openai.chat.completions.create({
          model: "deepseek-chat",
          messages: [{ role: "system", content: depthPrompt }, { role: "user", content: `标题：${title}\n内容：${fullText}` }],
          response_format: { type: 'json_object' }
        });

        const rawAiOutput = completion.choices[0].message.content || '';
        let cleanedJsonString = rawAiOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
        const firstBrace = cleanedJsonString.indexOf('{');
        const lastBrace = cleanedJsonString.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace >= firstBrace) {
            cleanedJsonString = cleanedJsonString.substring(firstBrace, lastBrace + 1);
        }

        const intel = JSON.parse(cleanedJsonString);

        // 🚨 核心修复：强制捕获并抛出数据库错误，补充 view_count 兜底
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
        if (process.env.NODE_ENV === 'development') {
           console.log(`🔴 [模块_崩溃] -> 定时抓取单条失败:`, e.message);
        }
        continue;
      }
    }

    return NextResponse.json({ success: true, processedCount });

  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
       console.log(`🔴 [模块_崩溃] -> 定时引擎核心崩溃:`, error.message);
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}