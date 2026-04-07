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
        console.log('🟡 [Terminal_异步] -> 接口: /api/terminal, 载荷深度:', payloadMessages.length);
      }

      const res = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId, messages: payloadMessages }),
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

      if (!res.ok) throw new Error(`流式网关阻断: HTTP ${res.status}`);
      if (!res.body) throw new Error('流式管道未建立');

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔵 [Terminal_成功] -> 组件: 终端字节流开始泵入，启动逐字解析');
      }

      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ') && !line.includes('[DONE]')) {
              try {
                const data = JSON.parse(line.slice(6)) as { choices: Array<{ delta?: { content?: string } }> };
                const delta = data.choices[0]?.delta?.content ?? '';

                if (delta) {
                  // 核心防线：绝对纯洁的闭包更新，精准锁定 UI 数组最后一条消息进行字符追加
                  setMessages((prev) => {
                    const newArr = [...prev];
                    const lastIdx = newArr.length - 1;
                    newArr[lastIdx] = {
                      ...newArr[lastIdx],
                      content: newArr[lastIdx].content + delta,
                    };
                    return newArr;
                  });
                }
              } catch {
                // 忽略流传输过程中的单行 JSON 碎片化报错
              }
            }
          }
        }
      }

      streamSucceeded = true;

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
