"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldAlert, Zap, Loader2, Mail, Key } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}

/**
 * 核心业务说明：
 * 渐进式诱捕墙组件 (Frictionless Onboarding Wall)。
 * 负责在用户触碰高级权限边界时弹出，完成注册/登录的无缝转化。
 */
export default function AuthModal({ 
  isOpen, 
  onClose, 
  title = "ACCESS RESTRICTED / 权限受限", 
  subtitle = "登录以解锁完整情报体征、暗影卷宗与终端追问。" 
}: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError(null);

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(`🟢 [模块_发起] -> 动作: 发起 ${isLogin ? '登录' : '注册'} 请求`);
      }

      const { error: authError } = isLogin 
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

      if (authError) throw authError;

      if (process.env.NODE_ENV === 'development') {
        console.log('🔵 [模块_成功] -> 产物: 会话已就绪');
      }
      
      onClose();
      router.refresh(); // 强制刷新路由，让 Server Components 感知最新会话
      
    } catch (err: unknown) { // 🚨 架构师防御矩阵：拔除 any 毒瘤，强制类型收缩
      const errMsg = err instanceof Error ? err.message : '认证物理链路断裂';
      setError(errMsg);
      if (process.env.NODE_ENV === 'development') {
        console.log('🔴 [模块_崩溃] -> 原因:', errMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md bg-white border border-zinc-200 rounded-lg shadow-xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-80" />
          
          <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-800 transition-colors">
            <X size={20} />
          </button>

          <div className="p-8">
            <div className="flex flex-col items-center mb-8 text-center">
              <ShieldAlert className="text-red-600 w-12 h-12 mb-4" />
              <h2 className="text-xl font-black text-zinc-900 uppercase tracking-widest mb-2">{title}</h2>
              <p className="text-[var(--td-text-secondary)] text-sm font-sans leading-relaxed">{subtitle}</p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  placeholder="CLASSIFIED EMAIL"
                  className="w-full bg-zinc-50 border border-zinc-200 focus:border-red-400 focus:ring-2 focus:ring-red-100 p-3 pl-12 text-sm font-mono text-zinc-900 placeholder:text-zinc-400 outline-none transition-all rounded-md"
                />
              </div>

              <div className="relative">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  placeholder="ENCRYPTED PASSCODE"
                  className="w-full bg-zinc-50 border border-zinc-200 focus:border-red-400 focus:ring-2 focus:ring-red-100 p-3 pl-12 text-sm font-mono text-zinc-900 placeholder:text-zinc-400 outline-none transition-all rounded-md"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-xs font-mono text-red-700 text-center tracking-wide">{error}</p>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-red-600 border border-red-600 hover:bg-red-700 text-white py-4 flex items-center justify-center gap-2 uppercase tracking-widest font-black text-sm transition-all rounded-md disabled:opacity-50 disabled:cursor-not-allowed mt-6 shadow-sm"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
                {isLogin ? '建立安全连接 (LOGIN)' : '注册机密档案 (SIGN UP)'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <button 
                type="button"
                onClick={() => { 
                  setIsLogin(!isLogin);
                  setError(null); 
                }}
                className="text-xs font-mono text-[var(--td-text-secondary)] hover:text-red-600 transition-colors tracking-wide underline decoration-zinc-300 underline-offset-4"
              >
                {isLogin ? "没有权限？申请机密档案 (Sign Up)" : "已有权限？返回安全连接 (Login)"}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}