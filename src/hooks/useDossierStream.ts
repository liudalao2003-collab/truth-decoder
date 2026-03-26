"use client";
import { useState } from 'react';
import { SignalRecord } from '@/types/database';

export function useDossierStream(signal: SignalRecord | null, lang: 'cn' | 'en') {
  const [dossierContent, setDossierContent] = useState<string>('');
  const [isStreamingDossier, setIsStreamingDossier] = useState(false);

  const startDossierStream = async () => {
    if (!signal?.raw_content || isStreamingDossier) return;
    setIsStreamingDossier(true);
    setDossierContent('');

    if (process.env.NODE_ENV === 'development') {
      console.log(`🟢 [模块_发起] -> 动作/参数: 激活暗影卷宗流式生成 (Lang: ${lang})`);
    }

    try {
      const res = await fetch('/api/v1/dossier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ=` 
        },
        body: JSON.stringify({ rawContent: signal.raw_content, lang }) // 🚀 核心修复：携带语种标识
      });

      if (!res.ok || !res.body) throw new Error('流式通道建立失败');

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('data: ') && !trimmedLine.includes('[DONE]')) {
              try {
                const data = JSON.parse(trimmedLine.slice(6));
                const delta = data.choices[0]?.delta?.content || '';
                if (delta) {
                  setDossierContent((prev) => prev + delta);
                }
              } catch (e) { /* 忽略流碎片 */ }
            }
          }
        }
      }
      if (process.env.NODE_ENV === 'development') {
        console.log('🔵 [模块_成功] -> 产物: 暗影卷宗生成完毕');
      }
    } catch (err: any) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔴 [模块_崩溃] -> 原因:', err.message || err);
      }
      alert("流式通道被截断，请检查网络。");
    } finally {
      setIsStreamingDossier(false);
    }
  };

  return { dossierContent, setDossierContent, isStreamingDossier, startDossierStream };
}