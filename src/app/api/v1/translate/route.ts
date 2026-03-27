import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'edge';

// 🚨 第一法则：严密的 TS 载荷契约，拒绝 any 投毒
interface TranslateRequest {
  content: string;
  targetLang: 'cn' | 'en';
}

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

/**
 * 核心业务说明：
 * 专属的双轨暗影卷宗翻译网关。
 * 它的唯一使命是：在绝对保留 [[词汇::注脚]] 物理边界的前提下，完成单语种向目标语种的无损降维转换。
 */
export async function POST(req: Request) {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('🟢 [模块_发起] -> 动作/参数: 唤醒暗影卷宗双轨翻译引擎');
    }

    // 1. 物理级鉴权防线 (复用现有网关权限)
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.INGEST_TOKEN}`) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔴 [模块_崩溃] -> 原因: 翻译网关越权访问被拦截');
      }
      return NextResponse.json({ success: false, error: 'Unauthorized: Clearance Level Too Low' }, { status: 401 });
    }

    // 2. 载荷解析与 TS 纯洁性校验
    const body = await req.json();
    const { content, targetLang } = body as TranslateRequest;

    if (!content || !targetLang) {
      return NextResponse.json({ success: false, error: 'Missing content or targetLang' }, { status: 400 });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`🟡 [模块_异步] -> 目标: 请求 DeepSeek 执行高精度翻译 (Target: ${targetLang})`);
    }

    // 3. 核心护栏：字典映射锚点保护 (Mapping Anchor Lockdown)
    // 业务说明：决定气泡功能生死的 System Prompt。强制大模型识别并原样保留语法边界。
    const systemPrompt = targetLang === 'en'
      ? `You are a top-tier financial and geopolitical translator. Translate the following "Shadow Dossier" into native, professional English.
[CRITICAL DIRECTIVE]: The text contains highly sensitive interactive anchors formatted EXACTLY as [[Surface Buzzword::Deep Insight]].
1. You MUST absolutely preserve the double brackets '[[' and ']]' and the double colons '::'.
2. You must translate both the "Surface Buzzword" and the "Deep Insight" into English, but KEEP them within the exact syntax.
3. Ensure the translated "Surface Buzzword" makes grammatical sense within the translated surrounding sentence.
4. Do NOT output any JSON. Output ONLY the translated Markdown text.`
      : `你是一名顶级的金融与地缘政治翻译官。请将以下的“暗影卷宗”翻译为极具专业感和穿透力的中文。
【最高指令】：原文中包含极度敏感的交互锚点，格式严格为 [[表层词汇::深度注脚]]。
1. 你必须绝对保留双括号 '[[' 和 ']]' 以及双冒号 '::' 的物理符号边界。
2. 将“表层词汇”和“深度注脚”都翻译成中文，但必须把它们原封不动地塞回这个语法结构里。
3. 确保翻译后的“表层词汇”在中文语境和句子中读起来通顺自然。
4. 严禁输出 JSON 或代码块标记！只输出翻译后的 Markdown 纯文本。`;

    // 4. 发起请求，强制降温
    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content }
      ],
      temperature: 0.1, // 🚨 极低温管控：剥夺大模型的发散创造权，确保翻译的绝对忠实
    });

    const translatedText = completion.choices[0].message.content || '';

    if (process.env.NODE_ENV === 'development') {
      console.log('🔵 [模块_成功] -> 产物: 翻译任务完成，锚点保留完好');
    }

    return NextResponse.json({ success: true, data: translatedText });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '翻译网关级联失效';
    if (process.env.NODE_ENV === 'development') {
      console.log('🔴 [模块_崩溃] -> 原因:', errMsg);
    }
    return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
  }
}