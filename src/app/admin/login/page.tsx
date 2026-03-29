"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Terminal, Loader2, User } from 'lucide-react';

/**
 * 核心业务说明：
 * Admin 中控台的物理门锁。
 * 已从单密码模式升级为标准的邮箱+密码体系，以对接 Supabase Auth。
 */
export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    setError(false);

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('🟢 [模块_发起] -> 动作/参数:', '向网关发送授权请求');
      }

      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (res.ok) {
        if (process.env.NODE_ENV === 'development') {
          console.log('🔵 [模块_成功] -> 产物:', '门锁已物理开启，请求路由重定向');
        }
        // 门锁开启，前往中控台
        router.push('/admin/dashboard');
      } else {
        throw new Error('授权被拒');
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🔴 [模块_崩溃] -> 原因:', '门锁拒绝开启');
      }
      setError(true);
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 selection:bg-red-900">
      <div className="scanline" />
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-12">
          <ShieldAlert className="text-red-600 w-16 h-16 mb-6" />
          <h1 className="text-2xl font-black tracking-[0.3em] uppercase italic text-zinc-300">Command Center</h1>
          <p className="text-[10px] font-mono text-red-600 tracking-[0.4em] mt-2">RESTRICTED AREA V2.0</p>
        </div>

        <form onSubmit={handleLogin} className="relative group space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
              <User className={`w-5 h-5 ${error ? 'text-red-500' : 'text-zinc-600 group-focus-within:text-red-500'} transition-colors`} />
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className={`w-full bg-zinc-950/50 border-2 ${error ? 'border-red-600 text-red-500' : 'border-zinc-800 focus:border-red-900'} p-4 pl-12 text-center text-sm font-mono tracking-widest outline-none transition-all placeholder:text-zinc-800 placeholder:tracking-normal`}
              placeholder="COMMANDER IDENTIFIER (EMAIL)"
              autoFocus
            />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
              <Terminal className={`w-5 h-5 ${error ? 'text-red-500' : 'text-zinc-600 group-focus-within:text-red-500'} transition-colors`} />
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className={`w-full bg-zinc-950/50 border-2 ${error ? 'border-red-600 text-red-500' : 'border-zinc-800 focus:border-red-900'} p-4 pl-12 text-center text-lg font-mono tracking-widest outline-none transition-all placeholder:text-zinc-800 placeholder:tracking-normal`}
              placeholder="ENCRYPTED PASSCODE"
            />
          </div>
          
          {error && <p className="absolute -bottom-8 left-0 w-full text-center text-xs font-mono text-red-500 tracking-widest uppercase">Unauthorized Access Detected</p>}
          
          <button type="submit" className="hidden">Submit</button>
        </form>

        {loading && (
          <div className="mt-8 flex justify-center">
            <Loader2 className="animate-spin text-red-600 w-6 h-6" />
          </div>
        )}
      </div>
    </main>
  );
}