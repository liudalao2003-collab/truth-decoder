import { useState } from 'react';
import { TerminalMessage } from '@/types';

interface UseTerminalMachineProps {
  signalId: string;
  hardFacts: string[];
}

export function useTerminalMachine({ signalId, hardFacts }: UseTerminalMachineProps) {
  const [messages, setMessages] = useState<TerminalMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitInterrogation = async (content: string) => {
    if (!content.trim() || isStreaming) return;

    console.log('🟢 [状态发起] -> 变量: 用户发起深度审讯:', content);

    // 1. 组装当前视角的完整 UI 历史
    const newUserMessage: TerminalMessage = { role: 'user', content };
    const currentHistory = [...messages, newUserMessage];

    // 2. UI 乐观更新：立刻上屏用户输入，并预置一个空的 assistant 气泡占位
    setMessages([...currentHistory, { role: 'assistant', content: '' }]);
    setIsStreaming(true);
    setError(null);

    try {
      // 3. 组装发往后端的载荷 (隐式首部强行挂载事实记忆，不暴露给 UI)
      const contextPayload: TerminalMessage = {
        role: 'system',
        content: `【系统强制指令】：本次审讯的底层硬通货如下：\n${hardFacts.join('\n')}\n请严格基于上述事实回答用户，保持冷酷、客观。`
      };
      
      const payloadMessages = [contextPayload, ...currentHistory];
      console.log('🟡 [网络请求] -> 接口: /api/terminal, 载荷深度:', payloadMessages.length);

      const res = await fetch('/api/terminal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signalId, messages: payloadMessages }),
      });

      if (!res.ok) throw new Error(`流式网关阻断: HTTP ${res.status}`);
      if (!res.body) throw new Error('流式管道未建立');

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      
      console.log('🔵 [数据渲染] -> 组件: 终端字节流开始泵入，启动逐字解析');

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
                const data = JSON.parse(line.slice(6));
                const delta = data.choices[0]?.delta?.content || '';

                if (delta) {
                  // 🚀 核心防线：绝对纯洁的闭包更新，精准锁定 UI 数组最后一条消息进行字符追加
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
              } catch (e) {
                // 忽略流传输过程中的单行 JSON 碎片化报错
              }
            }
          }
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : '字节流解析崩塌';
      console.log('🔴 [错误捕获] -> 节点: SSE 字节流泵入失败', errMsg);
      setError(errMsg);
    } finally {
      setIsStreaming(false);
    }
  };

  const clearTerminal = () => setMessages([]);

  return { messages, isStreaming, error, submitInterrogation, clearTerminal };
}