"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Terminal, Loader2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try { 
       const { data, error: authError } = await supabase.auth.signInWithPassword({ 
         email: email.trim(), // 🚀 自动修剪可能的空格 
         password: password, 
       }); 
 
       if (authError) { 
         // 🚨 探测 400 错误的真凶 
         console.error('🔴 Auth 物理级报错:', authError); 
         
         let customMsg = authError.message; 
         if (authError.message.includes('Invalid login credentials')) { 
           customMsg = '认证令牌无效：邮箱或密码错误，请核对。'; 
         } else if (authError.status === 400) { 
           customMsg = '请求被拦截：请确认密码长度或字符合法性。'; 
         } 
         throw new Error(customMsg); 
       } 
 
       // ... 后续逻辑保持不变 ...
       // 2. 权限隔离校验：非指挥官邮箱严禁入内
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
      if (data.user?.email !== adminEmail) {
        // 如果邮箱不匹配，强制登出以销毁 Session
        await supabase.auth.signOut();
        throw new Error('权限等级不足：检测到非法指挥官标识。');
      }

      // 3. 权限通过，进入指挥部
      router.push('/admin');
    } catch (err: any) {
      setError(err.message || '未知物理性故障');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 selection:bg-red-950">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center space-y-4">
          <ShieldAlert className="w-16 h-16 text-red-600 mx-auto animate-pulse" />
          <h1 className="text-4xl font-black tracking-[0.2em] uppercase italic italic">Command Center</h1>
          <p className="text-[10px] font-mono text-red-900 tracking-[0.5em] uppercase">Restricted Area V2.0</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Terminal className="text-red-900 group-focus-within:text-red-500 w-4 h-4 transition-colors" />
            </div>
            <input
              type="email"
              placeholder="COMMANDER IDENTIFIER (EMAIL)"
              className="w-full bg-black border border-red-900/30 p-4 pl-12 text-sm font-mono focus:border-red-600 outline-none transition-all placeholder:text-zinc-800"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-red-900 group-focus-within:text-red-500 font-mono text-lg transition-colors">{`>_`}</span>
            </div>
            <input
              type="password"
              placeholder="ENCRYPTED PASSCODE"
              className="w-full bg-black border border-red-900/30 p-4 pl-12 text-sm font-mono focus:border-red-600 outline-none transition-all placeholder:text-zinc-800"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-red-950/20 border border-red-900 text-red-500 font-black uppercase tracking-widest hover:bg-red-900 hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Execute Login'}
          </button>
        </form>

        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-4 bg-red-950/10 border border-red-900/50 flex items-start gap-3 rounded-sm"
            >
              <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16} />
              <div>
                <p className="text-[10px] font-mono text-red-500 uppercase tracking-widest mb-1">System Alert</p>
                <p className="text-xs text-red-400 font-mono leading-relaxed uppercase">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}