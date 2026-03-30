"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * 🚀 指挥部自动导航仪
 * 作用：物理重定向。将访问 /admin 的请求自动导向满血版仪表盘。
 */
export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    // 强制 shunting 至满血版 dashboard 
    router.replace('/admin/dashboard');
  }, [router]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
      <Loader2 className="animate-spin text-red-600 w-10 h-10 mb-4" />
      <p className="font-mono text-xs text-zinc-500 uppercase tracking-[0.3em]">
        Redirecting to Tactical Dashboard...
      </p>
    </div>
  );
}