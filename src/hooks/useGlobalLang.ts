"use client";
import { useState, useEffect, useCallback } from 'react';

export type LangType = 'cn' | 'en';

export function useGlobalLang() {
  // 🚀 架构师修复：惰性初始化，消灭 useEffect 内部的同步 setState 导致的级联渲染
  const [lang, setLangState] = useState<LangType>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('TRUTH_DECODER_LANG');
      return (stored === 'cn' || stored === 'en') ? stored : 'cn';
    }
    return 'cn';
  });

  useEffect(() => {
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
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🟢 [模块_发起] -> 动作/参数: 切换全局语种至`, newLang.toUpperCase());
    }
  }, [lang]);

  return { lang, setLang };
}