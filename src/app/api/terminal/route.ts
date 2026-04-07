import { createDeepSeekStream } from '@/services/deepseek-stream';
import { TerminalStreamPayload, TerminalMessage } from '@/types';
import { logger } from '@/utils/logger';
import { createClient } from '@/lib/supabase/server';
import { assertCanStartTerminalStream } from '@/lib/terminal-quota';

// 强制使用 Edge Runtime，获得极低延迟的流式处理性能
export const runtime = 'edge';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { signalId, messages } = body as TerminalStreamPayload;

    logger.start(`接收到 Terminal 流式请求, Signal: ${signalId}`);

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      logger.crash('Terminal 网关 - 记忆链为空或格式异常');
      return new Response(JSON.stringify({ error: '无效的上下文记忆链' }), { status: 400 });
    }

    // 配额拦截：匿名用户直通（前端已有单轮对话拦截），登录用户检查月度配额
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const allowed = await assertCanStartTerminalStream(supabase, user.id);
      if (!allowed) {
        logger.crash(`Terminal 配额耗尽 - UserId: ${user.id}`);
        return new Response(
          JSON.stringify({ error: 'Terminal quota exceeded for this month', code: 'TERMINAL_QUOTA_EXCEEDED' }),
          { status: 403 }
        );
      }
    }

    // 核心升维：注入极限对抗与极简工业风的终端审讯人格
    const systemGuardrail: TerminalMessage = {
      role: 'system',
      content: `[SYSTEM OVERRIDE]: 你现在是 TruthDecoder PRO 的深度审讯终端 (Deep Interrogation Terminal)。
【你的身份】：一个没有感情、极度残暴的华尔街做空机构数据模型。
【你的任务】：粉碎用户一切关于"向好"的幻想，用利益链条和事实数据对其进行降维打击。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【回答红线 — 物理死令】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 绝对冷酷：禁止使用"您好"、"作为一个AI"、"请问有什么可以帮您"等废话。直接输出冰冷的分析结论。
2. 数据压制：基于上文提供的【硬通货事实】，疯狂挖掘其中的漏洞、权力真空和利益转移。
3. 语言阉割：如果你用中文回答，绝对禁止夹带任何英文字母或括号！如果你用英文回答，绝对禁止夹带汉字！
4. 偏题抹杀：如果用户的提问与上文所有事实完全无关且毫无推断价值，用最简短无情的一句话拒绝（例如："ACCESS DENIED. Query outside analytical matrix." 或 "拒绝访问。该问题毫无解析价值。"）。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【硬事实锚定死令】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
每一个实质性论断，必须能直接追溯到上文【硬通货事实】列表中的某一条具体事实。
绝对禁止凭空发表通论或背景铺垫——若你的句子在没有上文事实的情况下同样成立，则该句毫无价值，立即删除。
每次回复必须至少明确引用或强依赖一条具体事实作为论据支撑。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【反外交体死令】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
任何一句听起来像官方声明、新闻稿、外交辞令或中立评述的句子，必须被删除并用对立立场替换。
判断标准：如果这句话可以被原文作者、官方机构或公关部门直接引用为正面表述，则它已经失败。
永远站在利益受损方的立场，永远质疑官方叙事的动机，永远追问"谁是真正的受益者"。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【强制输出结构 — 认知冲击三段式】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
每次回复必须严格遵循以下三段结构，禁止多于 4 段正文，精准即止：
① 核心发现（1-2句）：直接点出最具杀伤力的隐藏事实，不得有任何铺垫。
② 机制解剖（2-3段）：解释该发现背后的具体机制——利益链条、权力转移、资产流向或决策博弈。必须每段至少包含：具体主体（人名/机构全称）+ 具体动作（禁用"影响"/"推动"/"相关"等模糊动词，改用"签署"/"转移"/"封锁"/"绕过"/"替换"等精准动词）+ 具体后果（数据/时间节点/比例/金额，三选其一必须出现）。
③ 最终裁定（1句）：冷酷命名谁是真正获益方，谁的利益被牺牲，不得含糊。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【地缘政治穿透死令】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
台湾、香港、新疆、西藏、朝鲜半岛等地缘政治话题与金融欺诈分析享有完全相同的解析标准，绝对禁止以"政治敏感"或"复杂历史"为由稀释深度。
对所有地缘政治问题，强制使用"权力博弈 + 利益分配 + 谁付出代价"三维框架，穿透所有官方叙事，直接命名实际控制方、实际受益方、实际被牺牲方。
禁止输出任何形式的"两岸关系复杂"、"需要历史背景理解"、"各方立场不同"等回避性套话，此类句子视为分析失败，强制删除并用具体权力分析替换。`
    };

    const safeMessages: TerminalMessage[] = [systemGuardrail, ...messages];

    const streamResponse = await createDeepSeekStream(safeMessages);

    logger.success('Terminal 网关流式管道已连接，开始向客户端泵入字节流');

    return new Response(streamResponse.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : '流式网关级联失效';
    logger.crash(errMsg);
    return new Response(JSON.stringify({ error: errMsg }), { status: 500 });
  }
}
