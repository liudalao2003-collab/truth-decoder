import { useState, useEffect, useRef } from 'react';
import { TerminalMessage } from '@/types';

interface UseTerminalMachineProps {
  signalId: string;
  hardFacts: string[];
  onMessagesChange?: (messages: TerminalMessage[]) => void;
  /** 月度配额耗尽时触发，用于弹出升级提示 */
  onQuotaExceeded?: () => void;
}

export function useTerminalMachine({
  signalId,
  hardFacts,
  onMessagesChange,
  onQuotaExceeded,
}: UseTerminalMachineProps) {
  const [messages, setMessages] = useState<TerminalMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitInterrogation = async (content: string) => {
    if (!content.trim() || isStreaming) return;

    if (process.env.NODE_ENV === 'development') {
      console.log('🟢 [Terminal_发起] -> 动作/参数: 用户发起深度审讯:', content);
    }

    // 组装当前视角的完整 UI 历史
    const newUserMessage: TerminalMessage = { role: 'user', content };
    const currentHistory = [...messages, newUserMessage];

    // UI 乐观更新：立刻上屏用户输入，并预置一个空的 assistant 气泡占位
    setMessages([...currentHistory, { role: 'assistant', content: '' }]);
    setIsStreaming(true);
    setError(null);

    let streamSucceeded = false;

    try {
      // 组装发往后端的载荷（隐式首部强行挂载事实记忆，不暴露给 UI）
      const contextPayload: TerminalMessage = {
        role: 'system',
        content: `【系统强制指令】：本次审讯的底层硬通货如下：\n${hardFacts.join('\n')}\n请严格基于上述事实回答用户，保持冷酷、客观。`
      };
      
      const payloadMessages = [contextPayload, ...currentHistory];

      if (process.env.NODE_ENV === 'development') {
        console.log('🟡 [Terminal_异步] -> 接口: /api/v1/generation/jobs, 载荷深度:', payloadMessages.length);
      }

      const res = await fetch('/api/v1/generation/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          kind: 'terminal',
          payload: { signalId, messages: payloadMessages },
        }),
      });

      // 配额超限：触发外部回调，回滚 UI 至提交前状态
      if (res.status === 403) {
        let code = '';
        try {
          const errJson = await res.json() as { code?: string };
          code = errJson.code ?? '';
        } catch {
          // 忽略 JSON 解析失败
        }
        if (code === 'TERMINAL_QUOTA_EXCEEDED') {
          if (process.env.NODE_ENV === 'development') {
            console.log('🟡 [Terminal_异步] -> 目标: 月度审讯配额已耗尽，触发升级引导');
          }
          // 回滚 UI，移除乐观更新的消息
          setMessages(messages);
          onQuotaExceeded?.();
          return;
        }
      }

      if (!res.ok) throw new Error(`终端任务入队失败: HTTP ${res.status}`);
      const jobJson = (await res.json()) as { id: string; accessToken: string };
      if (!jobJson.id || !jobJson.accessToken) {
        throw new Error('终端任务响应缺少 id 或 accessToken');
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('🔵 [Terminal_成功] -> 组件: 任务已入队，开始轮询增量结果');
      }

      const deadline = Date.now() + 45 * 60 * 1000;
      let lastText = '';
      while (Date.now() < deadline) {
        await new Promise<void>((r) => {
          setTimeout(r, 800);
        });
        const pollRes = await fetch(
          `/api/v1/generation/jobs/${jobJson.id}?token=${encodeURIComponent(jobJson.accessToken)}`,
          { credentials: 'include' }
        );
        if (!pollRes.ok) {
          continue;
        }
        const data = (await pollRes.json()) as {
          status: string;
          resultText: string | null;
          errorMessage: string | null;
        };

        if (data.status === 'failed') {
          throw new Error(data.errorMessage ?? '终端生成任务失败');
        }

        const full = data.resultText ?? '';
        if (full !== lastText) {
          lastText = full;
          setMessages((prev) => {
            const newArr = [...prev];
            const lastIdx = newArr.length - 1;
            newArr[lastIdx] = {
              ...newArr[lastIdx],
              content: full,
            };
            return newArr;
          });
        }

        if (data.status === 'completed') {
          streamSucceeded = true;
          break;
        }
      }

      if (!streamSucceeded) {
        throw new Error('终端生成超时，请稍后重试');
      }

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : '字节流解析崩塌';
      if (process.env.NODE_ENV === 'development') {
        console.log('🔴 [Terminal_崩溃] -> 节点: SSE 字节流泵入失败', errMsg);
      }
      setError(errMsg);
    } finally {
      setIsStreaming(false);

      // 流式成功后，fire-and-forget 调用计次接口，不阻塞 UI
      if (streamSucceeded) {
        fetch('/api/v1/terminal/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ signalId }),
        }).catch(() => {
          // 计次失败不影响用户体验，静默忽略
        });
      }
    }
  };

  const clearTerminal = () => setMessages([]);

  const onMessagesChangeRef = useRef(onMessagesChange);
  onMessagesChangeRef.current = onMessagesChange;
  useEffect(() => {
    onMessagesChangeRef.current?.(messages);
  }, [messages]);

  return { messages, isStreaming, error, submitInterrogation, clearTerminal };
}
