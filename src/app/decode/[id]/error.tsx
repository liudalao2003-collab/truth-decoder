"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw, ShieldAlert } from "lucide-react";


/**
 * 核心业务说明：
 * 局部容灾边界组件 (Error Boundary)。
 * 它的作用是拦截该路由下任何未被捕获的 React 渲染错误或生命周期异常，
 * 提供物理级的降级 UI，保障 C 端/B 端用户的视觉体验不至于沦为浏览器默认的崩溃页。
 */
export default function DecodeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 强制在客户端记录崩溃死因，但不向外暴露机密环境信息
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔴 [模块_崩溃] -> Error Boundary 捕获到致命异常:`, error);
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-[var(--td-bg-page)] flex flex-col items-center justify-center p-8 selection:bg-red-100 selection:text-red-900">
      <div className="bg-white border border-red-200 p-10 rounded-lg text-center max-w-lg shadow-lg relative overflow-hidden">
        <ShieldAlert className="absolute -right-10 -top-10 w-40 h-40 text-red-100 pointer-events-none" />
        
        <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-6 animate-pulse" />
        
        <h2 className="text-2xl font-black text-zinc-900 mb-2 uppercase tracking-widest">
          SIGNAL LOST / 信号中断
        </h2>
        
        <p className="text-zinc-600 text-sm mb-8 font-mono bg-zinc-50 p-4 border border-zinc-200 rounded-md break-words">
          {error.message || "深层解码引擎遭遇未知阻击，链路已物理切断。"}
        </p>
        
        <button 
          onClick={() => reset()} 
          className="group relative bg-red-600 hover:bg-red-700 text-white px-8 py-4 font-black uppercase tracking-widest text-sm rounded-md overflow-hidden transition-all flex items-center justify-center gap-3 w-full shadow-md"
        >
          <RefreshCcw className="w-4 h-4 group-hover:-rotate-180 transition-transform duration-500" />
          重新建立连接
        </button>
      </div>
    </div>
  );
}