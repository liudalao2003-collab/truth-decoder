import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import OpenAI from 'openai';

// 🚀 加上这一行：强行将 Vercel 无服务器函数的存活时间提升至 60 秒极限！
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
    console.log("-----------------------------------------");
    console.log("⏰ [自动巡航] Vercel 送报员准点敲门...");
    
    const { data: configs } = await supabaseAdmin.from('system_configs').select('*');
    const configMap = configs?.reduce((acc: any, row: any) => ({ ...acc, [row.id]: row.value }), {}) || {};

    if (configMap.master_switch?.status === 'OFF') {
      console.log("🛑 [自动巡航] 总开关关闭，拒绝开门。");
      return NextResponse.json({ success: false, message: 'Master Switch is OFF' });
    }

    const frequencyMinutes = configMap.scrape_frequency?.interval_minutes || 60; 
    const lastRunTimeStr = configMap.cron_last_run?.time; 
    
    if (lastRunTimeStr) {
      const lastRun = new Date(lastRunTimeStr).getTime();
      const now = new Date().getTime();
      const minutesPassed = (now - lastRun) / (1000 * 60);

      if (minutesPassed < (frequencyMinutes - 1)) {
        console.log(`💤 [自动巡航] 离合器介入：距离上次执行仅过去 ${Math.round(minutesPassed)} 分钟，未达设定的 ${frequencyMinutes} 分钟。继续休眠。`);
        return NextResponse.json({ success: true, message: 'Clutch engaged' });
      }
    }

    console.log(`🔥 [自动巡航] 离合器放行！面板设定: 每 ${frequencyMinutes} 分钟。开始执行打击！`);

    await supabaseAdmin.from('system_configs').upsert({ 
      id: 'cron_last_run', 
      value: { time: new Date().toISOString() },
      updated_at: new Date().toISOString() 
    });

    const rawIntensity = configMap.scrape_intensity?.limit || 1;
    const intensity = Math.min(rawIntensity, 3); 
    const aiDepth = configMap.ai_depth?.mode || 'deep';

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
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const articleRes = await fetch(`https://r.jina.ai/${link}`, {
          headers: { 'X-Return-Format': 'markdown' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        let fullText = await articleRes.text();
        fullText = fullText.replace(/\[.*?\]\(.*?\)/g, '').replace(/!\[.*?\]/g, '').replace(/#+/g, '').replace(/\s+/g, ' ').substring(0, 3500);

        // 🧹 毒饵拦截：如果 Jina 被墙，立刻丢弃本篇
        if (fullText.includes('SecurityCompromiseError') || fullText.includes('DDoS attack') || fullText.includes('Too many domains')) {
            console.warn("⚠️ 踩中 WAF 毒饵，判定为爬虫拦截，丢弃此条。");
            continue; // 如果是手动投喂的独立文件，这里用 return 报错
        }

        if (fullText.length < 200) continue;

        const depthPrompt = `你是一个顶级情报解码器。请严格输出双语 JSON，必须保证深度：
{
  "facts": { "cn": ["必须提取3-5条核心事实"], "en": [] },
  "fluff": { "cn": ["必须深度剖析3-5条！禁止摘抄原文！直接点破其掩盖的风险或图谋"], "en": [] },
  "verdict": { "cn": "一句话点破真正意图，禁止废话。", "en": "" }
}`;


        const completion = await openai.chat.completions.create({
          model: "deepseek-chat",
          messages: [{ role: "system", content: depthPrompt }, { role: "user", content: `标题：${title}\n内容：${fullText}` }],
          response_format: { type: 'json_object' }
        });

        // 🛡️ 强制剥离大模型可能附带的 Markdown 代码块残留
        const rawAiOutput = completion.choices[0].message.content || ''
        const cleanedJsonString = rawAiOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
        const intel = JSON.parse(cleanedJsonString);

        await supabaseAdmin.from('signals').insert([{
          id: `SIGNAL_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          raw_content: `【标题】${title}\n\n【正文】\n${fullText}`,
          fluff_words: intel.fluff || { cn: [], en: [] }, 
          hard_facts: intel.facts || { cn: [], en: [] },
          verdict: intel.verdict?.cn || (intel.verdict || "解析失败"),
          metadata: { source_url: link } 
        }]);

        processedCount++;
      } catch (e) {
        continue;
      }
    }

    console.log(`✅ [自动巡航] 本次轰炸完毕！新增 ${processedCount} 篇情报。`);
    return NextResponse.json({ success: true, processedCount });

  } catch (error: any) {
    console.error("❌ [自动巡航] 核心崩溃:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}