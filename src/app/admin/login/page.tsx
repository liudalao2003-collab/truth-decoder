"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Terminal, Loader2 } from 'lucide-react';

export default function AdminLogin() {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode) return;
    
    setLoading(true);
    setError(false);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode })
      });

      if (res.ok) {
        // 门锁开启，前往中控台 (Dashboard)
        router.push('/admin/dashboard');
      } else {
        setError(true);
        setPasscode('');
      }
    } catch (err) {
      setError(true);
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
          <p className="text-[10px] font-mono text-red-600 tracking-[0.4em] mt-2">RESTRICTED AREA</p>
        </div>

        <form onSubmit={handleLogin} className="relative group">
          <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
            <Terminal className={`w-5 h-5 ${error ? 'text-red-500' : 'text-zinc-600 group-focus-within:text-red-500'} transition-colors`} />
          </div>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            disabled={loading}
            className={`w-full bg-zinc-950/50 border-2 ${error ? 'border-red-600 text-red-500' : 'border-zinc-800 focus:border-red-900'} p-4 pl-12 text-center text-lg font-mono tracking-widest outline-none transition-all placeholder:text-zinc-800 placeholder:tracking-normal`}
            placeholder="ENTER PASSCODE"
            autoFocus
          />
          {error && <p className="absolute -bottom-8 left-0 w-full text-center text-xs font-mono text-red-500 tracking-widest uppercase">Unauthorized Access</p>}
          
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