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
    
    const rssController = new AbortController();
    const rssTimeout = setTimeout(() => rssController.abort(), 5000);
    const rssRes = await fetch(targetUrl, {  
      cache: 'no-store', 
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36' },
      signal: rssController.signal
    });
    clearTimeout(rssTimeout);

    if (!rssRes.ok) throw new Error(`CNBC 接入失败: ${rssRes.status}`); 
    const rssText = await rssRes.text(); 
      
    const items = [...rssText.matchAll(/<item>[\s\S]*?<title>(.*?)<\/title>[\s\S]*?<link>(.*?)<\/link>/gi)].slice(0, intensity);
    if (items.length === 0) throw new Error("未能提取到有效新闻链接"); 

    let processedCount = 0;

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

    const scrapePromises = items.map(async (item) => {
      const title = item[1].replace(/<!\[CDATA\[|\]\]>/g, '');
      const link = item[2].trim(); 
      
      // 🚨 架构师加固：给单兵线程套上独立监控黑匣子
      try {
        const { data: existing } = await supabaseAdmin.from('signals').select('id').ilike('raw_content', `%${title.substring(0, 20)}%`).limit(1);
        if (existing && existing.length > 0) { 
          console.log(`⚠️ 重复情报跳过: ${title.substring(0, 30)}`);
          return; 
        } 

        let fullText = "";
        try {
          const jinaController = new AbortController();
          const jinaTimeoutId = setTimeout(() => jinaController.abort(), 8000); 

          const articleRes = await fetch(`https://r.jina.ai/${link}`, { 
            headers: { 'X-Return-Format': 'markdown' }, 
            signal: jinaController.signal 
          });
          clearTimeout(jinaTimeoutId); 
          fullText = await articleRes.text(); 
        } catch (e) {
          console.log(`⚠️ Jina 主引擎通信中断`);
        }

        fullText = fullText.replace(/\[.*?\]\(.*?\)/g, '').replace(/!\[.*?\]/g, '').replace(/#+/g, '').replace(/\s+/g, ' ');

        if (fullText.length < 200 || fullText.includes('SecurityCompromiseError') || fullText.includes('DDoS attack')) {
          console.log(`⚠️ Jina 遭拦截，启动原生直连降落伞...`);
          try {
            const fallbackController = new AbortController();
            const fallbackTimeout = setTimeout(() => fallbackController.abort(), 6000);
            const fallbackRes = await fetch(link, {
               headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36' },
               signal: fallbackController.signal
            });
            clearTimeout(fallbackTimeout);
            const rawHtml = await fallbackRes.text();

            fullText = rawHtml
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
          } catch (fallbackErr) {
            console.log(`❌ 备用引擎失效`);
            return; 
          }
        }

        fullText = fullText.substring(0, 2500);

        if (fullText.length < 200) { 
          console.log(`⚠️ 强洗后依然过短，物理抛弃: ${title.substring(0, 30)}`);
          return; 
        } 

        const dsController = new AbortController();
       // 🚀 架构师微调：在并发安全区内，将大模型思考死线放宽至 40 秒，大幅降低误杀率
const dsTimeoutId = setTimeout(() => dsController.abort(), 40000);

        const completion = await openai.chat.completions.create({ 
          model: "deepseek-chat", 
          messages: [ 
            { role: "system", content: depthPrompt }, 
            { role: "user", content: `标题：${title}\n内容：${fullText}` } 
          ], 
          response_format: { type: 'json_object' } 
        }, {
          signal: dsController.signal as any 
        }); 
        clearTimeout(dsTimeoutId);

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

        if (dbError) throw new Error(`DB写入拒接: ${dbError.message}`);

        processedCount++; 
        console.log(`✅ 成功落盘: ${title.substring(0, 30)}`);

      } catch (innerError: any) {
        // 🚀 核心修复：捕获被 25 秒铡刀切断抛出的 AbortError 或 JSON 解析失败
        console.log(`🔴 [单兵线程阵亡] 标题: ${title.substring(0, 15)}... 死因: ${innerError.message || innerError.name}`);
      }
    });

    await Promise.allSettled(scrapePromises);

    return NextResponse.json({ success: true, processedCount });

  } catch (error: any) { 
    console.error(`🔴 云端引擎核心崩溃:`, error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 }); 
  } 
}