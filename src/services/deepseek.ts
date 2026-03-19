/**
 * 核心业务说明：
 * TruthDecoder 2.2 强化版博弈引擎 (Hotfix)。
 * 修复：重新注入 JSON 键名硬契约，修复 Zod 校验拦截导致的 500 宕机。
 */

import { DecodeResult } from '@/types';
import { z } from 'zod';
import { logger } from '@/utils/logger';

// 1. Zod 绝对防御契约
const DecodeResultSchema = z.object({
  fluffWords: z.array(z.string()).describe("原文中的粉饰词"),
  hardFacts: z.array(z.string()).length(3).describe("3条极度冷峻的底层事实"),
  verdict: z.string().describe("150字内深刻点评")
});

async function callDeepSeek(prompt: string, content: string, temp: number, json: boolean = false): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('系统配置异常：未侦测到神经引擎访问令牌。');

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: prompt }, { role: 'user', content: content }],
      response_format: json ? { type: 'json_object' } : { type: 'text' },
      temperature: temp,
    }),
  });
  
  if (!res.ok) {
    const errorData = await res.text();
    throw new Error(`上游通信失败: HTTP ${res.status} - ${errorData}`);
  }
  
  const data = await res.json();
  return data.choices[0].message.content;
}

export async function analyzeTextWithDeepSeek(content: string): Promise<DecodeResult> {
  logger.start(`启动 2.2 逻辑进化引擎`);

  try {
    // Round 1: 蓝军 - 商业逻辑推演
    logger.async('Round 1: 蓝军发力');
    const bluePrompt = `你是一个顶级商业顾问。请分析该动作的“商业定价逻辑”。将外交/政治动作转化为商业上的“价格谈判”、“服务订阅”或“资产重组”模型。不要说废话。`;
    const blueRes = await callDeepSeek(bluePrompt, content, 0.4);

    // Round 2: 红军 - 真实代价狙击
    logger.async('Round 2: 红军狙击');
    const redPrompt = `你是一个多疑的风险控制专家。质疑上述的商业逻辑。指出该动作背后的真实成本、权力转嫁以及它掩盖的政治/经济漏洞。`;
    const redContent = `原文: ${content}\n蓝方类比: ${blueRes}`;
    const redRes = await callDeepSeek(redPrompt, redContent, 0.6);

    // Round 3: 法官 - 终极合成
    logger.async('Round 3: 法官裁决与格式化');
    // 🚨 致命修复：强制规定 JSON 的确切键名，确保 Zod 能够精准放行
    const judgePrompt = `你是 TruthDecoder 的首席战略官。你的任务是综合多方博弈后的逻辑，输出一份唯一的、具备顶级穿透力的报告。
【强制要求】：
1. 绝对禁止提及“红军”、“蓝军”、“博弈”、“分析师”等词汇。
2. 绝对禁止描述你的分析过程，只输出结论。
3. verdict 必须像刀刃一样，直接指出这是一场什么样的“利益收割”或“权力交换”。
4. hardFacts 必须是基于原文数据提炼出的、不可辩驳的底层事实。
你必须严格输出 JSON 格式，且必须完全符合以下结构：
{
  "fluffWords": ["煽动词1", "煽动词2"],
  "hardFacts": ["事实1", "事实2", "事实3"],
  "verdict": "一句话穿透利益逻辑的终极点评"
}`;

    const judgeContent = `【原始数据】: ${content}\n【内部逻辑 A】: ${blueRes}\n【内部逻辑 B】: ${redRes}`;

    let final: DecodeResult | null = null;
    let temp = 0.3;
    let lastError = null;

    for (let i = 0; i < 3; i++) {
      try {
        const raw = await callDeepSeek(judgePrompt, judgeContent, temp, true);
        const parsed = JSON.parse(raw);
        final = DecodeResultSchema.parse(parsed) as DecodeResult;
        break; // 格式正确，突围成功
      } catch (e) {
        lastError = e;
        temp = Math.max(0.01, temp - 0.1);
        logger.crash(`Zod 护盾击碎非法数据，触发第 ${i+1} 次降温重试`);
      }
    }

    if (!final) {
      throw new Error(`逻辑合成防线崩塌，最后死因: ${lastError instanceof Error ? lastError.message : 'JSON 结构严重畸形'}`);
    }

    logger.success('高净值情报已合成，契约已兑现。');
    return final;

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '未知解析异常';
    logger.crash(`[节点: analyzeTextWithDeepSeek] -> ${errMsg}`);
    throw new Error(errMsg); // 将真实死因抛给上层，不要模糊为“解密失败”
  }
}