"use client";
import { useState, useEffect } from 'react';
import { SignalRecord } from '@/types/database';

export function useDossierStream(signal: SignalRecord | null, lang: 'cn' | 'en') {
  const [cache, setCache] = useState<Record<'cn' | 'en', string>>({ cn: '', en: '' });
  const [isStreamingDossier, setIsStreamingDossier] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  // 🚨 架构师防线：新增截断预警状态机
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    if (signal?.dossier_content) {
      if (typeof signal.dossier_content === 'string') {
        setCache(prev => ({ ...prev, cn: signal.dossier_content as string }));
      } else {
        setCache({
          cn: signal.dossier_content.cn || '',
          en: signal.dossier_content.en || ''
        });
      }
    }
  }, [signal?.dossier_content]);

  useEffect(() => {
    const triggerTranslation = async () => {
      if (!signal?.id || isStreamingDossier || isTranslating) return;

      const currentText = cache[lang];
      const sourceLang = lang === 'cn' ? 'en' : 'cn';
      const sourceText = cache[sourceLang];

      if (!currentText && sourceText) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`🟡 [模块_异步] -> 目标: 探测到 [${lang}] 缓存击穿，启动流式懒翻译补全协议`);
        }
        setIsTranslating(true);
        try {
          const res = await fetch('/api/v1/translate', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_INGEST_TOKEN || 'ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ='}` 
            },
            body: JSON.stringify({ content: sourceText, targetLang: lang })
          });
          
          if (!res.ok || !res.body) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `网关物理阻断: HTTP ${res.status}`);
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let done = false;
          let buffer = '';
          let fullTranslatedText = '';

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
                      fullTranslatedText += delta;
                      setCache((prev) => ({ ...prev, [lang]: fullTranslatedText }));
                    }
                  } catch (e) { /* 忽略流碎片 */ }
                }
              }
            }
          }
            
          fetch('/api/v1/dossier/sync', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_INGEST_TOKEN || 'ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ='}` 
            },
            body: JSON.stringify({ id: signal.id, dossier_content: { ...cache, [lang]: fullTranslatedText } })
          }).catch(e => {
             if (process.env.NODE_ENV === 'development') console.log('🔴 [同步失败] ->', e);
          });
        } catch (err: unknown) {
           if (process.env.NODE_ENV === 'development') console.log('🔴 [翻译崩塌] ->', err);
        } finally {
          setIsTranslating(false);
        }
      }
    };

    triggerTranslation();
  }, [lang, cache, signal?.id, isTranslating, isStreamingDossier]);

  const startDossierStream = async () => {
    if (!signal?.raw_content || isStreamingDossier) return;
    setIsStreamingDossier(true);
    setIsTruncated(false);
    setCache(prev => ({ ...prev, [lang]: '' }));

    if (process.env.NODE_ENV === 'development') {
      console.log(`🟢 [模块_发起] -> 动作/参数: 激活暗影卷宗流式生成 (Lang: ${lang})`);
    }

    try {
      const res = await fetch('/api/v1/dossier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_INGEST_TOKEN || 'ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ='}` 
        },
        body: JSON.stringify({ rawContent: signal.raw_content, lang }) 
      });

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `网关物理阻断: HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;
      let buffer = '';
      
      // 🚨 探针：生命周期标识
      let receivedDoneSignal = false;
      let finishReason = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('data: ')) {
              if (trimmedLine.includes('[DONE]')) {
                receivedDoneSignal = true;
                continue;
              }
              try {
                const data = JSON.parse(trimmedLine.slice(6));
                const delta = data.choices[0]?.delta?.content || '';
                const currentFinishReason = data.choices[0]?.finish_reason;
                
                if (currentFinishReason) {
                  finishReason = currentFinishReason;
                }

                if (delta) {
                  setCache((prev) => ({ ...prev, [lang]: prev[lang] + delta }));
                }
              } catch (e) { /* 忽略流碎片 */ }
            }
          }
        }
      }
      
      // 🚨 裁决：如果是因为超长而结束，或根本没收到结束符，则判定为物理截断
      if (finishReason === 'length' || !receivedDoneSignal) {
        setIsTruncated(true);
        if (process.env.NODE_ENV === 'development') {
          console.log(`🔴 [模块_崩溃] -> 原因: 卷宗生成被物理截断。FinishReason: ${finishReason}, DoneSignal: ${receivedDoneSignal}`);
        }
      }

      setCache(finalCache => {
        fetch('/api/v1/dossier/sync', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NEXT_PUBLIC_INGEST_TOKEN || 'ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ='}` 
            },
            body: JSON.stringify({ id: signal.id, dossier_content: finalCache })
        }).catch(() => {});
        return finalCache;
      });

    } catch (err: unknown) {
       if (process.env.NODE_ENV === 'development') console.log('🔴 [流式中断] ->', err);
       setIsTruncated(true); // 网络异常直接标记截断
    } finally {
      setIsStreamingDossier(false);
    }
  };

  return { dossierContent: cache[lang], isStreamingDossier, isTranslating, isTruncated, startDossierStream };
}