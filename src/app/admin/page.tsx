"use client";
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function AdminDashboard() {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

      if (user && user.email === adminEmail) {
        setIsAuthorized(true);
      } else {
        router.replace('/admin/login');
      }
    };
    checkAuth();
  }, [router]);

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="animate-spin text-red-600 w-12 h-12" />
        <span className="ml-4 text-zinc-500 font-mono text-xs uppercase tracking-[0.3em]">Authenticating Commander...</span>
      </div>
    );
  }

  return (
    <div className="p-8 text-white font-mono">
      <h1 className="text-2xl font-black mb-8 border-l-4 border-red-600 pl-4">COMMAND CENTER V2.0</h1>
      {/* 🚀 这里是您现有的控制面板内容 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="border border-zinc-800 p-6 bg-zinc-950 hover:border-red-900 transition-all cursor-pointer">
          <p className="text-[10px] text-zinc-500 mb-2 uppercase tracking-widest">Total Signals</p>
          <p className="text-4xl font-black text-red-600">--</p>
        </div>
        {/* ... */}
      </div>
    </div>
  );
}