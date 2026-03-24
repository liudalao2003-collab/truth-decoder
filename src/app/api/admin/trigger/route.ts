import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

async function verifyCommander() {
  const cookieStore = await cookies();
  const token = cookieStore.get('truth_admin_token');
  return token?.value === 'ACCESS_GRANTED_2026';
}

export async function POST() {
  if (!(await verifyCommander())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    console.log("-----------------------------------------");
    console.log("🚀 [云端引擎] 战术迂回：全面切入 CNBC 国际金融流...");
    
    const { data: configs } = await supabaseAdmin.from('system_configs').select('*');
    const configMap = configs?.reduce((acc: any, row: any) => ({ ...acc, [row.id]: row.value }), {}) || {};

    if (configMap.master_switch?.status === 'OFF') {
      return NextResponse.json({ success: false, message: 'Master Switch is OFF' });
    }

    const rawIntensity = configMap.scrape_intensity?.limit || 1;
    const intensity = Math.min(rawIntensity, 3); // 强行限制为 3 条，防 Vercel 超时
    const aiDepth = configMap.ai_depth?.mode || 'deep';

    // 🎯 战术转移：CNBC 的 RSS 极度稳定，绝对不会 403
    const targetUrl = 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664';
    console.log("📡 [1/4] 正在无阻碍接入 CNBC RSS...");
    
    const rssRes = await fetch(targetUrl, { 
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36' }
    });

    if (!rssRes.ok) throw new Error(`CNBC 接入失败: ${rssRes.status}`);
    const rssText = await rssRes.text();
    
    const items = [...rssText.matchAll(/<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>/gi)].slice(0, intensity);
    if (items.length === 0) throw new Error("未能提取到有效新闻链接");

    let processedCount = 0;

    for (const item of items) {
      try {
        const title = item[1].replace(/<!\[CDATA\[|\]\]>/g, '');
        const link = item[2].trim();
        
        console.log(`🕵️‍♂️ [2/4] 正在潜入 CNBC 原文: ${title.substring(0, 30)}...`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const articleRes = await fetch(`https://r.jina.ai/${link}`, {
          headers: { 'X-Return-Format': 'markdown' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        let fullText = await articleRes.text();

        console.log("🧹 [3/4] 绞肉机启动：抹除 CNBC 导航垃圾...");
        // 🚀 核心过滤：彻底粉碎 Jina 解析出来的网页杂质
        fullText = fullText.replace(/\[.*?\]\(.*?\)/g, ''); // 抹除超链接
        fullText = fullText.replace(/!\[.*?\]/g, '');       // 抹除图片
        fullText = fullText.replace(/#+/g, '');             // 抹除 Markdown 标题符号
        fullText = fullText.replace(/\s+/g, ' ').substring(0, 3500); // 压缩空格，截取精华

        if (fullText.length < 200) {
          console.warn("⚠️ 提纯后情报量过低 (可能是视频新闻)，跳过该目标。");
          continue;
        }

        console.log(`🧠 [4/4] 已获得完美纯净生肉 (${fullText.length}字)，移交 AI 深度审判...`);

        const depthPrompt = aiDepth === 'quick' 
          ? "提取核心 facts 和一句 verdict，双语 JSON。"
          : "你是一个冷酷的华尔街分析师。请将以下洗净的新闻通稿深度解码为中英双语 JSON：{ \"facts\": {\"cn\":[\"骨干事实1\", \"事实2\"], \"en\":[]}, \"fluff\": {\"cn\":[\"隐秘动机或套话1\"], \"en\":[]}, \"verdict\": {\"cn\":\"一段辛辣的最终裁决\", \"en\":\"\"} }";

        const completion = await openai.chat.completions.create({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: depthPrompt },
            { role: "user", content: `标题：${title}\n内容：${fullText}` }
          ],
          response_format: { type: 'json_object' }
        });

        const intel = JSON.parse(completion.choices[0].message.content || '{}');

        await supabaseAdmin.from('signals').insert([{
          id: `SIGNAL_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
          raw_content: `【标题】${title}\n\n【正文】\n${fullText}`,
          fluff_words: intel.fluff || { cn: [], en: [] }, 
          hard_facts: intel.facts || { cn: [], en: [] },
          verdict: intel.verdict?.cn || (intel.verdict || "解析失败"),
          metadata: { source_url: link } 
        }]);

        processedCount++;
        console.log("✅ 纯净审判完成，已落盘。");

      } catch (innerError: any) {
        console.error(`⚠️ 单条情报处理失败 (${innerError.name}):`, innerError.message);
        continue; 
      }
    }

    return NextResponse.json({ success: true, processedCount });

  } catch (error: any) {
    console.error("❌ [云端引擎] 核心逻辑崩溃:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}