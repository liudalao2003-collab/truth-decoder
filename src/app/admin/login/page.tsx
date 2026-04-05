"use client";
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

import { ShieldAlert, Terminal, Loader2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const handleLogin = async (e: React.FormEvent) => { 
     e.preventDefault(); 
     setLoading(true); 
     setError(null);
     try { 
       await supabase.auth.signOut();
       
       const { data, error: authError } = await supabase.auth.signInWithPassword({ 
         email: email.trim().toLowerCase(),
         password: password, 
       });
       
       if (authError) throw new Error(`身份核验失败: ${authError.message}`); 
 
       const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
       
       console.log('当前登录:', data.user?.email); 
       console.log('系统要求:', adminEmail);
       
       if (data.user?.email?.toLowerCase() !== adminEmail?.toLowerCase()) { 
         await supabase.auth.signOut(); 
         throw new Error(`权限等级不足：您的邮箱与系统设定的指挥官标识不符。`);
       } 
 
       window.location.href = '/admin';
       
     } catch (err: unknown) { 
      const errMsg = err instanceof Error ? err.message : '未知认证异常 (物理级断联)'; 
      setError(errMsg); 
    } finally { 
       setLoading(false); 
     } 
   };

  return (
    <main className="min-h-screen bg-[var(--td-surface-0)] text-zinc-900 flex flex-col items-center justify-center p-4 selection:bg-red-100 selection:text-red-900">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md space-y-8 bg-white border border-[var(--td-border)] rounded-lg shadow-lg p-8"
      >
        <div className="text-center space-y-4">
          <ShieldAlert className="w-16 h-16 text-red-600 mx-auto" />
          <h1 className="text-4xl font-black tracking-[0.2em] uppercase italic text-zinc-900">Command Center</h1>
          <p className="text-[10px] font-mono text-[var(--td-text-secondary)] tracking-[0.35em] uppercase">Restricted area v2.0</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Terminal className="text-zinc-400 group-focus-within:text-red-500 w-4 h-4 transition-colors" />
            </div>
            <input
              type="email"
              placeholder="COMMANDER IDENTIFIER (EMAIL)"
              className="w-full bg-zinc-50 border border-zinc-200 p-4 pl-12 text-sm font-mono text-zinc-900 focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition-all rounded-md placeholder:text-zinc-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-zinc-400 group-focus-within:text-red-500 font-mono text-lg transition-colors">{`>_`}</span>
            </div>
            <input
              type="password"
              placeholder="ENCRYPTED PASSCODE"
              className="w-full bg-zinc-50 border border-zinc-200 p-4 pl-12 text-sm font-mono text-zinc-900 focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition-all rounded-md placeholder:text-zinc-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-red-600 border border-red-600 text-white font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2 rounded-md shadow-sm"
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
              className="p-4 bg-red-50 border border-red-200 flex items-start gap-3 rounded-md"
            >
              <AlertTriangle className="text-red-600 shrink-0 mt-0.5" size={16} />
              <div>
                <p className="text-[10px] font-mono text-red-700 uppercase tracking-widest mb-1">System Alert</p>
                <p className="text-xs text-red-800 font-mono leading-relaxed uppercase">{error}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}
