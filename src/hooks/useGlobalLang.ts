"use client";
import { useState, useEffect, useCallback } from 'react';

export type LangType = 'cn' | 'en';

export function useGlobalLang() {
  // 🚀 核心修复：初始状态强制对齐服务端 (cn)，避免 React 418 报错
  const [lang, setLangState] = useState<LangType>('cn');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // 组件挂载后，安全提取本地缓存
    setIsMounted(true);
    const stored = localStorage.getItem('TRUTH_DECODER_LANG') as LangType;
    if (stored === 'cn' || stored === 'en') {
      setLangState(stored);
    }

    const handleLangChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ lang: LangType }>;
      if (customEvent.detail && customEvent.detail.lang) {
        setLangState(customEvent.detail.lang);
      }
    };

    window.addEventListener('EVENT_LANG_CHANGE', handleLangChange);
    return () => window.removeEventListener('EVENT_LANG_CHANGE', handleLangChange);
  }, []);

  const setLang = useCallback((newLang: LangType) => {
    if (newLang === lang) return;
    localStorage.setItem('TRUTH_DECODER_LANG', newLang);
    setLangState(newLang);
    window.dispatchEvent(new CustomEvent('EVENT_LANG_CHANGE', { detail: { lang: newLang } }));
  }, [lang]);

  // 🛡️ 架构师防线：在挂载前统一输出 'cn'，挂载后输出真实语言，完美规避 Hydration 撕裂
  return { lang: isMounted ? lang : 'cn', setLang };
}