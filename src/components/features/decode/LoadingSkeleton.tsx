/**
 * 核心业务说明：
 * 深度定制的报告骨架屏。
 * 布局严格 1:1 还原 DecodePage 的双栏网格与底部面板。
 * 作用：在数据从 Supabase 泵入前端的间隙，维持 UI 的稳定性，防止布局抖动。
 */
export default function LoadingSkeleton() {
  return (
    <div className="space-y-12 animate-pulse">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-[550px] bg-zinc-100 border border-zinc-200 rounded-lg">
          <div className="p-4 border-b border-zinc-200 flex gap-3">
            <div className="w-2 h-2 bg-zinc-300 rounded-full" />
            <div className="w-24 h-3 bg-zinc-200 rounded-sm" />
          </div>
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-4 bg-zinc-200/80 rounded-sm w-full" />
            ))}
          </div>
        </div>

        <div className="h-[550px] bg-white border border-zinc-200 border-l-4 border-l-zinc-300 rounded-lg flex flex-col">
          <div className="p-4 border-b border-zinc-200 flex gap-3">
            <div className="w-4 h-4 bg-zinc-200 rounded-sm" />
            <div className="w-32 h-3 bg-zinc-200 rounded-sm" />
          </div>
          <div className="p-8 flex-1 flex flex-col justify-center gap-12">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-6 items-start">
                <div className="text-5xl font-black text-zinc-200 select-none">0{i}</div>
                <div className="h-8 bg-zinc-100 rounded-sm w-full mt-2" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-zinc-50 border border-zinc-200 border-t-4 border-t-red-400 p-16 rounded-lg">
        <div className="w-40 h-3 bg-zinc-200 mb-8 rounded-sm" />
        <div className="w-full h-12 bg-zinc-100 rounded-sm" />
      </div>
    </div>
  );
}
