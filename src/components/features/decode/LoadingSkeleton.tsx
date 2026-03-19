/**
 * 核心业务说明：
 * 深度定制的报告骨架屏。
 * 布局严格 1:1 还原 DecodePage 的双栏网格与底部面板。
 * 作用：在数据从 Supabase 泵入前端的间隙，维持 UI 的稳定性，防止布局抖动。
 */
export default function LoadingSkeleton() {
  return (
    <div className="space-y-12 animate-pulse">
      {/* 核心解码面板骨架 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左侧：原文占位 */}
        <div className="h-[550px] bg-zinc-900/50 border border-zinc-800 rounded-sm">
          <div className="p-4 border-b border-zinc-800 flex gap-3">
            <div className="w-2 h-2 bg-zinc-800 rounded-full" />
            <div className="w-24 h-3 bg-zinc-800 rounded-sm" />
          </div>
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-4 bg-zinc-800/50 rounded-sm w-full" />
            ))}
          </div>
        </div>
        
        {/* 右侧：硬通货事实占位 */}
        <div className="h-[550px] bg-zinc-950 border border-zinc-800 border-l-4 border-l-zinc-800 rounded-sm flex flex-col">
          <div className="p-4 border-b border-zinc-800 flex gap-3">
            <div className="w-4 h-4 bg-zinc-800 rounded-sm" />
            <div className="w-32 h-3 bg-zinc-800 rounded-sm" />
          </div>
          <div className="p-8 flex-1 flex flex-col justify-center gap-12">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-6 items-start">
                <div className="text-5xl font-black text-zinc-900 select-none">0{i}</div>
                <div className="h-8 bg-zinc-900/50 rounded-sm w-full mt-2" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 底部判决面板占位 */}
      <div className="bg-zinc-900/10 border border-zinc-800 border-t-4 border-t-zinc-800 p-16 rounded-sm">
        <div className="w-40 h-3 bg-zinc-800 mb-8 rounded-sm" />
        <div className="w-full h-12 bg-zinc-900/50 rounded-sm" />
      </div>
    </div>
  );
}