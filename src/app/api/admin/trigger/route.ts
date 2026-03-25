import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';
import OpenAI from 'openai';

// 🚀 核心防线：强行将 Vercel 无服务器函数的存活时间提升至 60 秒极限
export const maxDuration = 60;

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
    if (process.env.NODE_ENV === 'development') {
        console.log("🟢 [模块_发起] -> 云端引擎战术迂回：全面切入 CNBC...");
    }

    const { data: configs } = await supabaseAdmin.from('system_configs').select('*');
    const configMap = configs?.reduce((acc: any, row: any) => ({ ...acc, [row.id]: row.value }), {}) || {};

    if (configMap.master_switch?.status === 'OFF') {
      return NextResponse.json({ success: false, message: 'Master Switch is OFF' });
    }

    const rawIntensity = configMap.scrape_intensity?.limit || 1;
    const intensity = Math.min(rawIntensity, 3);
    const aiDepth = configMap.ai_depth?.mode || 'deep';

    const targetUrl = 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664';

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

        if (process.env.NODE_ENV === 'development') {
           console.log(`🟡 [模块_异步] -> 正在潜入 CNBC 原文: ${title.substring(0, 30)}...`);
        }

        const controller = new AbortController();
        // 🚨 核心修复：放宽 Jina 抓取超时至 25 秒，防 AbortError
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const articleRes = await fetch(`https://r.jina.ai/${link}`, {
          headers: { 'X-Return-Format': 'markdown' },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        let fullText = await articleRes.text();
        fullText = fullText.replace(/\[.*?\]\(.*?\)/g, '').replace(/!\[.*?\]/g, '').replace(/#+/g, '').replace(/\s+/g, ' ').substring(0, 3500);

        if (fullText.length < 200) continue;

        const depthPrompt = aiDepth === 'quick' 
          ? "提取核心 facts 和一句 verdict，双语 JSON。"
          : `你是一个冷酷的华尔街分析师。请将以下洗净的新闻通稿深度解码为中英双语 JSON：{ "facts": {"cn":["骨干事实1", "事实2"], "en":[]}, "fluff": {"cn":["隐秘动机或套话1"], "en":[]}, "verdict": {"cn":"一段辛辣的最终裁决", "en":""} }`;

        const completion = await openai.chat.completions.create({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: depthPrompt },
            { role: "user", content: `标题：${title}\n内容：${fullText}` }
          ],
          response_format: { type: 'json_object' }
        });

        // 引入 JSON 清洗护盾
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
          metadata: { source_url: link } 
        }]);

        if (dbError) {
           throw new Error(`数据库强制拒收: ${dbError.message} (代码: ${dbError.code})`);
        }

        processedCount++;
        if (process.env.NODE_ENV === 'development') {
           console.log("🔵 [模块_成功] -> 纯净审判完成，已真实落盘。");
        }

      } catch (innerError: any) {
        if (process.env.NODE_ENV === 'development') {
            console.log(`🔴 [模块_崩溃] -> 单条情报处理失败:`, innerError.message);
        }
        continue; 
      }
    }

    return NextResponse.json({ success: true, processedCount });

  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
       console.log(`🔴 [模块_崩溃] -> 云端引擎核心崩溃:`, error.message);
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
