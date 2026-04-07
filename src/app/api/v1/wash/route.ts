import { NextResponse } from 'next/server';
import { assertIngestAuthorized } from '@/lib/ingest-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateIntelProfile } from '@/services/intel-profile';
import type { IntelProfileError } from '@/types/intel-profile';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

/**
 * 核心业务：全量资产红利重铸引擎 V9.1
 *
 * V9.1 修复：
 * - 与 ingest route 同步，彻底加固 EN 字段语言隔离死令。
 * - 根治爬虫抓取英文新闻后，英文模式下红字气泡夹带中文的问题。
 */
export async function POST(req: Request) {
  try {
    const auth = await assertIngestAuthorized(req);
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id, rawContent } = await req.json();
    if (!id || !rawContent) throw new Error('Missing ID or Content');

    const systemPrompt = `[SYSTEM OVERRIDE: TruthDecoder PRO - Asset Recast Engine V9.1]
You are a top-tier short-selling analyst. Rebuild the source material into structured intelligence JSON.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ABSOLUTE LANGUAGE ISOLATION LAW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"cn" fields: 100% PURE CHINESE ONLY. No English letters, no abbreviations. Translate all terms (CEO → 首席执行官).
"en" fields: 100% PURE ENGLISH ONLY. ZERO Chinese characters. ZERO bilingual parentheticals. Every single character must be English.
This is a PHYSICAL HARD BLOCK. Violations corrupt the entire output.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DISSECTION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. No Emoji symbols.
2. Minimum 150 characters per fluff entry. Must include [Surface Disguise], [Core Mechanism], [Harvest Cost].
3. Use DuPont analysis, game theory, or MECE for deep deconstruction. No hollow descriptions.
4. Uniqueness: fluff keys must be unique and verbatim from source text.
5. NO newline characters (\\n) inside JSON string values.
6. Contradiction Mandate: Every fluff entry must expose a direct contradiction between the source's stated purpose and the actual financial/power mechanism it serves. Generic surface descriptions with no hidden contradiction are not acceptable — they will be rejected.
7. Specificity Mandate: Name the specific beneficiary (not just "certain parties" or "the company"), the specific transfer mechanism, and the specific group whose interests are being silently extracted. Vague, non-committal language invalidates the entry.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MANDATORY JSON OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{
  "verdict": { "cn": "一句话中文判决。", "en": "A ruthless English verdict." },
  "facts": { "cn": ["中文事实1", "中文事实2", "中文事实3"], "en": ["English fact 1", "English fact 2", "English fact 3"] },
  "fluff": {
    "cn": ["原文词汇的中文翻译::[表层伪装]中文分析...[核心机制]中文分析...[收割代价]中文分析..."],
    "en": ["OriginalEnglishTerm::[Surface Disguise] English analysis...[Core Mechanism] English analysis...[Harvest Cost] English analysis..."]
  }
}`;

    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: rawContent }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const intel = JSON.parse(completion.choices[0].message.content || '{}');

    const { data: existingRow } = await supabaseAdmin
      .from('signals')
      .select('metadata')
      .eq('id', id)
      .single();

    const prevMeta =
      existingRow?.metadata &&
      typeof existingRow.metadata === 'object' &&
      !Array.isArray(existingRow.metadata)
        ? (existingRow.metadata as Record<string, unknown>)
        : {};

    const metaRest = { ...prevMeta };
    delete metaRest.intelProfileError;

    const mergedMeta: Record<string, unknown> = {
      ...metaRest,
      bilingual: intel.verdict,
      washed: true,
      model: 'deepseek-v3',
    };

    try {
      const profile = await generateIntelProfile(rawContent, intel.facts);
      mergedMeta.intelProfile = profile;
      delete mergedMeta.intelProfileError;
    } catch (e: unknown) {
      const errPayload: IntelProfileError = {
        message: e instanceof Error ? e.message : '情报体征生成失败',
        at: new Date().toISOString(),
      };
      mergedMeta.intelProfileError = errPayload;
      delete mergedMeta.intelProfile;
    }

    const { error: dbError } = await supabaseAdmin
      .from('signals')
      .update({
        fluff_words: intel.fluff,
        hard_facts: intel.facts,
        verdict: intel.verdict?.cn || "解析失败",
        metadata: mergedMeta,
      })
      .eq('id', id);

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, message: `Signal ${id} Washed & Upgraded` });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '资产重塑过程遭遇致命死锁';
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}