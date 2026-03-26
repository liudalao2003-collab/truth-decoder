"use client";
import { useState, useEffect, useCallback } from 'react';

export type LangType = 'cn' | 'en';

// 核心说明书：
// 轻量级全局语种状态引擎。
// 通过 localStorage 与 window.dispatchEvent (EVENT_LANG_CHANGE) 实现跨组件、跨页面单向数据流。
// 彻底规避 React Context 造成的全局 Feed 流连带无效重渲染，确保性能红线。
export function useGlobalLang() {
  const [lang, setLangState] = useState<LangType>('cn');

  useEffect(() => {
    // 1. 初始化时读取本地记忆
    const storedLang = localStorage.getItem('TRUTH_DECODER_LANG') as LangType;
    if (storedLang === 'cn' || storedLang === 'en') {
      setLangState(storedLang);
    }

    // 2. 监听全局广播事件
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
    
    // 写入物理缓存
    localStorage.setItem('TRUTH_DECODER_LANG', newLang);
    setLangState(newLang);
    
    // 派发全局事件，通知所有订阅此 Hook 的孤岛组件执行局部重绘
    window.dispatchEvent(new CustomEvent('EVENT_LANG_CHANGE', { detail: { lang: newLang } }));
    
    // 结构化日志探头：仅在开发环境汇报状态流转
    if (process.env.NODE_ENV === 'development') {
      console.log(`🟢 [模块_发起] -> 动作/参数: 切换全局语种至`, newLang.toUpperCase());
    }
  }, [lang]);

  return { lang, setLang };
}
