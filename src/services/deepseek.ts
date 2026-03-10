import { DecodeResult } from '@/types';

const SYSTEM_PROMPT = `
你是一位年薪百万的资深商业情报分析师与地缘政治专家。你的任务是对用户输入的官方通稿、公关文或新闻进行极致的“去伪存真”。
剥离所有宏大叙事、情绪引导词和无意义修饰，只提取底层的利益流转、权力变动或真实的商业动作。

你必须严格输出纯 JSON 对象，严禁包含任何 Markdown 标记 (如 \`\`\`json) 或额外解释。
必须严格遵循以下 JSON 结构：
{
  "fluffWords": ["提取原文中的煽动词", "宏大叙事修饰语", "假大空词汇"],
  "hardFacts": [
    "事实 1：必须极其冷峻，只包含核心商业动作、裁员、资金走向或权力更迭 (禁止形容词)。",
    "事实 2：指出该动作的真实受害者或受益方。",
    "事实 3：揭露其掩盖的真实危机或战略意图。"
  ],
  "verdict": "一句话穿透利益逻辑的终极冷峻点评"
}
要求：hardFacts 数组必须且只能有 3 条。
`;

export async function analyzeTextWithDeepSeek(content: string): Promise<DecodeResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  
  if (!apiKey) {
    console.log('🔴 [错误捕获] -> 节点: DeepSeek 服务层 - API Key 缺失');
    throw new Error('系统配置异常：未侦测到神经引擎访问令牌。');
  }

  console.log('🟡 [网络请求] -> 接口: api.deepseek.com/chat/completions, 载荷长度:', content.length);

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `请立即解码以下截获的通稿：\n\n${content}` }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`上游通信失败: HTTP ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    
    const parsedData: DecodeResult = JSON.parse(rawContent);
    console.log('🔵 [数据渲染] -> 组件: DeepSeek 服务层解析完毕, 提取事实数量:', parsedData.hardFacts?.length);
    
    return parsedData;

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '未知解析异常';
    console.log('🔴 [错误捕获] -> 节点: analyzeTextWithDeepSeek', errorMessage);
    throw new Error('情报提取失败，大模型信号中断或返回了被污染的数据格式。');
  }
}