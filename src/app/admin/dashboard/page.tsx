"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Power, Activity, Clock, BrainCircuit, Rocket, ShieldAlert, Loader2, CheckCircle2, LogOut } from 'lucide-react';

export default function AdminDashboard() {
  // 🛡️ 新增防线：权限状态与路由
  const [isAuthorized, setIsAuthorized] = useState(false);
  const router = useRouter();

  // 📦 您原有的业务状态
  const [masterSwitch, setMasterSwitch] = useState(true);
  const [intensity, setIntensity] = useState(50);
  const [frequency, setFrequency] = useState('60');
  const [aiDepth, setAiDepth] = useState('deep'); 
  
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 📡 挂载时：鉴权 + 拉取真实配置 (完美融合)
  useEffect(() => {
    const checkAuthAndFetchConfigs = async () => {
      // 1. 终极物理鉴权防线
      const { data: { user } } = await supabase.auth.getUser();
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

      if (!user || user.email?.toLowerCase() !== adminEmail?.toLowerCase()) {
        router.replace('/admin/login');
        return;
      }
      
      setIsAuthorized(true);

      // 2. 您原有的拉取配置逻辑
      try {
        const res = await fetch('/api/admin/config');
        const json = await res.json();
        if (json.success && json.data) {
          const cfg = json.data;
          if (cfg.master_switch) setMasterSwitch(cfg.master_switch.status === 'ON');
          if (cfg.scrape_intensity) setIntensity(cfg.scrape_intensity.limit);
          if (cfg.scrape_frequency) setFrequency(String(cfg.scrape_frequency.interval_minutes));
          if (cfg.ai_depth) setAiDepth(cfg.ai_depth.mode);
        }
      } catch (e) {
        console.error("连接神经中枢失败", e);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthAndFetchConfigs();
  }, [router]);

  // 🛡️ 架构师赠礼：一键物理断开连接 (登出)
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  // 📡 您原有的交互逻辑：精准轰入数据库
  const saveConfig = async (id: string, value: unknown) => {
    setIsSaving(true);
    try {
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, value })
      });
    } catch (e) {
      console.error(`更新 ${id} 失败`, e);
    } finally {
      setIsSaving(false);
    }
  };

  // 🚀 您原有的触发逻辑：即刻触发
  const handleExecuteNow = async () => {
    setIsExecuting(true);
    try {
      const res = await fetch('/api/admin/trigger', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        alert(`引擎轰炸完毕！成功新增 ${json.processedCount} 条绝密情报。请去前端首页查看！`);
      } else {
        alert(`拦截：${json.message || json.error}`);
      }
    } catch (e) {
      alert("引擎启动失败，请检查控制台日志。");
    } finally {
      setIsExecuting(false);
    }
  };

  // 🛡️ 融合后的加载状态拦截
  if (isLoading || !isAuthorized) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-red-600">
          <Loader2 className="animate-spin w-12 h-12" />
          <p className="font-mono text-xs tracking-widest uppercase">Syncing with Core...</p>
        </div>
      </div>
    );
  }

  // 👇 以下完全是您原版的心血 UI，一行未改，仅在 Header 追加了登出按钮
  return (
    <main className="min-h-screen bg-[#050505] text-zinc-300 font-sans selection:bg-red-900 selection:text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <header className="flex items-center justify-between border-b border-zinc-900 pb-6">
          <div className="flex items-center gap-4">
            <ShieldAlert className="text-red-600 w-10 h-10" />
            <div>
              <h1 className="text-2xl font-black tracking-widest uppercase italic text-white">Command Center</h1>
              <p className="text-[10px] font-mono text-zinc-500 tracking-[0.3em]">TRUTH DECODER // ADMIN DASHBOARD</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
              <span className="text-xs font-mono text-zinc-400 hidden md:inline-block">DB CONNECTED</span>
            </div>
            {/* 新增的物理登出按钮 */}
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 text-xs font-mono text-zinc-500 hover:text-red-500 transition-colors px-3 py-1 border border-zinc-800 hover:border-red-900 rounded-sm"
            >
              <LogOut size={14} /> EXIT
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <section className="bg-black border border-zinc-900 p-6 flex items-center justify-between group hover:border-red-900/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${masterSwitch ? 'bg-red-900/20 text-red-500' : 'bg-zinc-900 text-zinc-500'}`}>
                <Power size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">系统总开关</h3>
                <p className="text-xs text-zinc-500 font-mono">遇到紧急情况或 API 欠费，一键断电</p>
              </div>
            </div>
            <button 
              onClick={() => { 
                const newVal = !masterSwitch;
                setMasterSwitch(newVal); 
                saveConfig('master_switch', { status: newVal ? 'ON' : 'OFF' });
              }}
              className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors ${masterSwitch ? 'bg-red-600' : 'bg-zinc-700'}`}
            >
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${masterSwitch ? 'translate-x-9' : 'translate-x-1'}`} />
            </button>
          </section>

          <section className="bg-black border border-zinc-900 p-6 flex flex-col justify-center group hover:border-zinc-700 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Rocket className="text-blue-500" size={20} />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">即刻触发 (Override)</h3>
              </div>
            </div>
            <button 
              onClick={handleExecuteNow}
              disabled={isExecuting || !masterSwitch}
              className={`w-full py-4 text-sm font-bold tracking-widest uppercase flex items-center justify-center gap-3 transition-all ${
                !masterSwitch ? 'bg-zinc-900 text-zinc-700 cursor-not-allowed' :
                isExecuting ? 'bg-blue-900/50 text-blue-400 border border-blue-900' : 
                'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)]'
              }`}
            >
              {isExecuting ? <Loader2 className="animate-spin" size={18} /> : <Rocket size={18} />}
              {isExecuting ? '云端引擎轰鸣中...' : '立即手动执行一次'}
            </button>
          </section>

          <section className="bg-black border border-zinc-900 p-6 group hover:border-zinc-700 transition-colors md:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Activity className="text-yellow-500" size={20} />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">抓取猛烈程度 (Intensity)</h3>
              </div>
              <span className="text-2xl font-black text-yellow-500 font-mono">{intensity} <span className="text-sm text-zinc-500">条/次</span></span>
            </div>
            <input 
              type="range" min="1" max="500" 
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
              onMouseUp={() => saveConfig('scrape_intensity', { limit: intensity })}
              onTouchEnd={() => saveConfig('scrape_intensity', { limit: intensity })}
              className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-yellow-500"
            />
            <div className="flex justify-between text-xs text-zinc-600 font-mono mt-2">
              <span>温柔扫街 (1)</span><span>饱和式轰炸 (500)</span>
            </div>
          </section>

          <section className="bg-black border border-zinc-900 p-6 group hover:border-zinc-700 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="text-purple-500" size={20} />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">捕获频率 (Frequency)</h3>
            </div>
            <select 
              value={frequency}
              onChange={(e) => { 
                const val = e.target.value;
                setFrequency(val); 
                saveConfig('scrape_frequency', { interval_minutes: Number(val) }); 
              }}
              className="w-full bg-zinc-900 border border-zinc-800 text-white p-3 font-mono outline-none focus:border-purple-500 transition-colors cursor-pointer"
            >
              <option value="30">每 30 分钟 (极速盯盘)</option>
              <option value="60">每 1 小时 (常规巡视)</option>
              <option value="360">每 6 小时 (慢速沉淀)</option>
              <option value="1440">每 24 小时 (每日复盘)</option>
            </select>
          </section>

          <section className="bg-black border border-zinc-900 p-6 group hover:border-zinc-700 transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <BrainCircuit className="text-emerald-500" size={20} />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">AI 深度 (Cognition)</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => { setAiDepth('quick'); saveConfig('ai_depth', { mode: 'quick' }); }}
                className={`p-3 text-sm font-bold border transition-all ${aiDepth === 'quick' ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
              >快速摘要</button>
              <button 
                onClick={() => { setAiDepth('deep'); saveConfig('ai_depth', { mode: 'deep' }); }}
                className={`p-3 text-sm font-bold border transition-all ${aiDepth === 'deep' ? 'bg-emerald-900/30 border-emerald-500 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
              >深度复盘</button>
            </div>
          </section>

        </div>

        <div className="flex justify-end pt-4">
          <div className="flex items-center gap-2 text-xs font-mono">
            {isSaving ? (
              <span className="text-yellow-500 flex items-center gap-2"><Loader2 className="animate-spin w-3 h-3" /> 同步至神经中枢...</span>
            ) : (
              <span className="text-green-500 flex items-center gap-2"><CheckCircle2 className="w-3 h-3" /> 遥控器与 Supabase 保持心跳连接</span>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}