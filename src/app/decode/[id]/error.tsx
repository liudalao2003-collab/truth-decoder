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
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 selection:bg-red-900">
      <div className="bg-zinc-950 border border-red-900/50 p-10 rounded-sm text-center max-w-lg shadow-[0_0_50px_rgba(153,27,27,0.1)] relative overflow-hidden">
        <ShieldAlert className="absolute -right-10 -top-10 w-40 h-40 text-red-900/10 pointer-events-none" />
        
        <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-6 animate-pulse" />
        
        <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-widest">
          SIGNAL LOST / 信号中断
        </h2>
        
        <p className="text-zinc-400 text-sm mb-8 font-mono bg-black/50 p-4 border border-zinc-900 rounded-sm break-words">
          {error.message || "深层解码引擎遭遇未知阻击，链路已物理切断。"}
        </p>
        
        <button 
          onClick={() => reset()} 
          className="group relative bg-red-700 hover:bg-red-600 text-white px-8 py-4 font-black uppercase tracking-widest text-sm rounded-sm overflow-hidden transition-all flex items-center justify-center gap-3 w-full"
        >
          <RefreshCcw className="w-4 h-4 group-hover:-rotate-180 transition-transform duration-500" />
          重新建立连接
        </button>
      </div>
    </div>
  );
}