import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase'; 
import { cookies } from 'next/headers'; 
import OpenAI from 'openai';

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

    // 🚀 架构师重构：统一定义核级 Prompt，防止幻觉
    const depthPrompt = aiDepth === 'quick'  
      ? "提取核心 facts 和一句 verdict，双语 JSON。" 
      : `【系统最高权限指令：TruthDecoder PRO 终极微观解剖引擎】
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

    // 🚀 架构师重构：将串行阻塞改为并发集群轰炸 (Promise.allSettled)
    const scrapePromises = items.map(async (item) => {
      const title = item[1].replace(/<!\[CDATA\[|\]\]>/g, '');
      const link = item[2].trim(); 
        
      // 🚨 护盾 1：查重拦截
      const { data: existing } = await supabaseAdmin.from('signals').select('id').ilike('raw_content', `%${title.substring(0, 20)}%`).limit(1);
      if (existing && existing.length > 0) { 
        console.log(`⚠️ 发现重复情报，跳过: ${title.substring(0, 30)}`);
        return; 
      } 

      const controller = new AbortController();
      // 缩短 Jina 请求超时时间，防止单点拖死全局
      const timeoutId = setTimeout(() => controller.abort(), 15000); 

      const articleRes = await fetch(`https://r.jina.ai/${link}`, { 
        headers: { 'X-Return-Format': 'markdown' }, 
        signal: controller.signal 
      });
      clearTimeout(timeoutId); 

      let fullText = await articleRes.text(); 
      fullText = fullText.replace(/\[.*?\]\(.*?\)/g, '').replace(/!\[.*?\]/g, '').replace(/#+/g, '').replace(/\s+/g, ' ').substring(0, 3500);

      if (fullText.length < 200) { 
        console.log(`⚠️ 提纯后文本过短，抛弃: ${title.substring(0, 30)}`);
        return; 
      } 

      const completion = await openai.chat.completions.create({ 
        model: "deepseek-chat", 
        messages: [ 
          { role: "system", content: depthPrompt }, 
          { role: "user", content: `标题：${title}\n内容：${fullText}` } 
        ], 
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

      // 🚨 护盾 2：落盘并发
      const { error: dbError } = await supabaseAdmin.from('signals').insert([{ 
        id: `SIGNAL_${Math.random().toString(36).substring(2, 10).toUpperCase()}`, 
        raw_content: `【标题】${title}\n\n【正文】\n${fullText}`, 
        fluff_words: intel.fluff || { cn: [], en: [] },  
        hard_facts: intel.facts || { cn: [], en: [] }, 
        verdict: intel.verdict?.cn || (intel.verdict || "解析失败"), 
        view_count: 0, 
        metadata: { source_url: link, bilingual: intel.verdict || {} }  
      }]);

      if (dbError) throw new Error(`数据库写入被拒: ${dbError.message}`);

      processedCount++; 
      console.log(`✅ 成功落盘: ${title.substring(0, 30)}`);
    });

    // 坐和放宽，等待所有并发线程执行完毕（即使某个失败，也不会引发主线程 500）
    await Promise.allSettled(scrapePromises);

    return NextResponse.json({ success: true, processedCount });

  } catch (error: any) { 
    console.error(`🔴 云端引擎核心崩溃:`, error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 }); 
  } 
}