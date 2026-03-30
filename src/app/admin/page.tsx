"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut, Database, Zap, Clock } from 'lucide-react';

interface Signal {
  id: string;
  created_at: string;
  verdict: string;
  raw_content: string;
}

export default function AdminDashboard() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0 });
  const [recentSignals, setRecentSignals] = useState<Signal[]>([]);
  const router = useRouter();

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      // 1. 验证身份
      const { data: { user } } = await supabase.auth.getUser();
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

      if (user && user.email?.toLowerCase() === adminEmail?.toLowerCase()) {
        setIsAuthorized(true);
        // 2. 身份合法，拉取战报数据
        fetchDashboardData();
      } else {
        router.replace('/admin/login');
      }
    };
    checkAuthAndFetchData();
  }, [router]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // 获取总破译数量
      const { count } = await supabase.from('signals').select('*', { count: 'exact', head: true });
      setStats({ total: count || 0 });

      // 获取最新 10 条破译记录
      const { data } = await supabase
        .from('signals')
        .select('id, created_at, verdict, raw_content')
        .order('created_at', { ascending: false })
        .limit(10);
        
      setRecentSignals(data || []);
    } catch (error) {
      console.error("数据抓取失败:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-red-600 w-12 h-12" />
        <span className="ml-4 text-zinc-500 font-mono text-xs uppercase tracking-[0.3em]">Authenticating Commander...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-300 font-sans p-8">
      <div className="max-w-[1400px] mx-auto">
        
        {/* 顶部导航 */}
        <header className="flex items-center justify-between mb-12 border-b border-zinc-900 pb-6">
          <div className="flex items-center gap-4">
            <Zap className="text-red-600 w-6 h-6" />
            <h1 className="text-2xl font-black uppercase tracking-widest text-white">Command Center <span className="text-red-600">V2.0</span></h1>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs font-mono text-zinc-500 hover:text-red-500 transition-colors px-4 py-2 border border-zinc-800 hover:border-red-900 rounded-sm"
          >
            <LogOut size={14} /> EXFILTRATE (LOGOUT)
          </button>
        </header>

        {/* 核心数据大屏 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="border border-zinc-800 p-6 bg-zinc-950/50 hover:border-red-900 transition-all relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-red-900/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-150" />
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Total Signals Decoded</p>
              <Database className="text-zinc-700 w-4 h-4" />
            </div>
            <p className="text-5xl font-black text-white">
              {isLoading ? <Loader2 className="animate-spin w-8 h-8 text-red-600 mt-2" /> : stats.total}
            </p>
          </div>
          {/* 这里可以预留更多数据模块，如今日新增、高频词汇等 */}
        </div>

        {/* 最新情报列表 */}
        <div>
          <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <Clock size={14} /> Recent Intercepts
          </h2>
          
          <div className="bg-zinc-950 border border-zinc-900 rounded-sm overflow-hidden">
            {isLoading ? (
              <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-zinc-600" /></div>
            ) : recentSignals.length === 0 ? (
              <div className="p-12 text-center text-zinc-600 font-mono text-sm">暂无破译情报。请投送新闻通稿。</div>
            ) : (
              <div className="divide-y divide-zinc-900">
                {recentSignals.map((signal) => (
                  <div key={signal.id} className="p-4 hover:bg-zinc-900/30 transition-colors group flex items-start gap-4 cursor-pointer" onClick={() => router.push(`/decode/${signal.id}`)}>
                    <div className="mt-1">
                      <div className="w-2 h-2 rounded-full bg-red-900 group-hover:bg-red-500 transition-colors shadow-[0_0_10px_rgba(220,38,38,0.5)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-[10px] text-red-500 font-mono bg-red-950/30 px-2 py-0.5 border border-red-900/50 rounded-sm">
                          {signal.id}
                        </span>
                        <span className="text-[10px] text-zinc-600 font-mono">
                          {new Date(signal.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-300 font-medium truncate mb-1">
                        {signal.verdict || "判决生成中..."}
                      </p>
                      <p className="text-xs text-zinc-600 truncate">
                        {signal.raw_content.substring(0, 100).replace(/\n/g, ' ')}...
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}