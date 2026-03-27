"use client";
import { useState, useEffect, useRef } from 'react';
import { SignalRecord } from '@/types/database';

export function useDossierStream(signal: SignalRecord | null, lang: 'cn' | 'en') {
  // 🚀 核心防线 1：双轨闭包缓存，绝不污染全局状态
  const [cache, setCache] = useState<Record<'cn' | 'en', string>>({ cn: '', en: '' });
  const [isStreamingDossier, setIsStreamingDossier] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  // 🛡️ 状态初始化：从底层契约提取双语卷宗并注入本地缓存
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

  // 🚀 核心防线 2：懒翻译与静默回写守护进程
  useEffect(() => {
    const triggerTranslation = async () => {
      if (!signal?.id || isStreamingDossier || isTranslating) return;

      const currentText = cache[lang];
      const sourceLang = lang === 'cn' ? 'en' : 'cn';
      const sourceText = cache[sourceLang];

      // 判定逻辑：当前语种为空，但源语种存在 -> 触发暗影翻译
      if (!currentText && sourceText) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`🟡 [模块_异步] -> 目标: 探测到 [${lang}] 缓存击穿，启动懒翻译补全协议`);
        }
        setIsTranslating(true);
        try {
          const res = await fetch('/api/v1/translate', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ=` 
            },
            body: JSON.stringify({ content: sourceText, targetLang: lang })
          });
          
          const json = await res.json();
          if (json.success && json.data) {
            const translatedText = json.data;
            const updatedCache = { ...cache, [lang]: translatedText };
            
            // 1. 瞬间更新前端闭包缓存
            setCache(updatedCache);
            
            // 2. 异步发射脱壳请求，静默回写至 Supabase 进行双规持久化
            fetch('/api/v1/dossier/sync', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ=` 
              },
              body: JSON.stringify({ id: signal.id, dossier_content: updatedCache })
            }).catch(e => {
               if (process.env.NODE_ENV === 'development') console.log('🔴 [同步失败] ->', e);
            });
          }
        } catch (err: unknown) {
           if (process.env.NODE_ENV === 'development') console.log('🔴 [翻译崩塌] ->', err);
        } finally {
          setIsTranslating(false);
        }
      }
    };

    triggerTranslation();
  }, [lang, cache, signal?.id, isTranslating, isStreamingDossier]);

  // 🚀 初次生成流式引擎
  const startDossierStream = async () => {
    if (!signal?.raw_content || isStreamingDossier) return;
    setIsStreamingDossier(true);
    setCache(prev => ({ ...prev, [lang]: '' }));

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
        body: JSON.stringify({ rawContent: signal.raw_content, lang }) 
      });

      // 🚨 架构师防线：强行撕开黑盒，将后端的真实崩溃日志透传到前端控制台 
       if (!res.ok || !res.body) { 
         const errData = await res.json().catch(() => ({})); 
         throw new Error(errData.error || `网关物理阻断: HTTP ${res.status}`); 
       }

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
                  // 精准泵入当前语种的缓存管道
                  setCache((prev) => ({ ...prev, [lang]: prev[lang] + delta }));
                }
              } catch (e) { /* 忽略流碎片 */ }
            }
          }
        }
      }
      
      // 🚀 流式生成结束后，立刻执行第一次双规持久化
      setCache(finalCache => {
        fetch('/api/v1/dossier/sync', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ThiGarIm5q+dEuji8a8wdpsOXoe2Sy/CsKCQa6wS5SQ=` 
            },
            body: JSON.stringify({ id: signal.id, dossier_content: finalCache })
        }).catch(() => {});
        return finalCache;
      });

    } catch (err: unknown) {
       if (process.env.NODE_ENV === 'development') console.log('🔴 [流式中断] ->', err);
    } finally {
      setIsStreamingDossier(false);
    }
  };

  // 抛出当前语种指向的精确缓存文本
  return { dossierContent: cache[lang], isStreamingDossier, isTranslating, startDossierStream };
}