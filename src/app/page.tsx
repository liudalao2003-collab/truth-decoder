"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Sparkles, Loader2, AlertTriangle } from 'lucide-react';
import { i18n } from '@/config/i18n';

export default function HomePage() {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleStart = async () => {
    if (!input.trim()) return;
    setIsSubmitting(true);
    setError(null);
    console.log('🟢 [状态发起] -> 变量: 提交通稿至云端引擎');
    
    try {
      const res = await fetch('/api/decode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input })
      });
      const json = await res.json();
      
      if (!res.ok || !json.success) throw new Error(json.error || '引擎调度失败');

      // 拿到唯一 ID，跳转至真实路由
      router.push(`/decode/${json.data.id}`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : '未知网络错误';
      setError(errMsg);
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white p-8 flex flex-col items-center justify-center">
      <div className="w-full max-w-4xl space-y-8">
        <header className="flex items-center gap-4 border-b border-red-900 pb-6">
          <ShieldAlert className="text-red-600 w-12 h-12" />
          <div>
            <h1 className="text-4xl font-black tracking-tighter uppercase">{i18n.header.title}</h1>
            <p className="text-xs font-mono text-red-500 tracking-widest">{i18n.header.version}</p>
          </div>
        </header>

        {error && (
          <div className="bg-red-950/50 border border-red-900 p-4 flex items-center gap-3 text-red-400 rounded-sm">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-mono">{error}</span>
          </div>
        )}

        <section className="bg-zinc-900/50 border border-zinc-800 p-8 rounded-sm shadow-2xl">
          <h2 className="text-xl font-bold mb-4 border-l-4 border-red-700 pl-3">{i18n.home.title}</h2>
          <textarea 
            className="w-full h-64 bg-zinc-950 border border-zinc-800 p-6 text-xl font-serif outline-none focus:border-red-600 transition-all resize-none selection:bg-red-900"
            placeholder={i18n.home.placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isSubmitting}
          />
          <button 
            onClick={handleStart}
            disabled={!input.trim() || isSubmitting}
            className={`w-full mt-6 py-6 text-xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all rounded-sm ${
              !input.trim() || isSubmitting 
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                : 'bg-red-700 hover:bg-red-600 shadow-[0_0_20px_rgba(185,28,28,0.2)] hover:shadow-[0_0_40px_rgba(185,28,28,0.4)]'
            }`}
          >
            {isSubmitting ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {isSubmitting ? 'DEEPSEEK ENGINE RUNNING...' : i18n.home.button}
          </button>
        </section>
      </div>
    </main>
  );
}