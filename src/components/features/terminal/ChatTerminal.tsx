"use client";
import React, { useRef, useEffect, useState } from 'react';
import { Terminal as TerminalIcon, Send, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { useTerminalMachine } from '@/hooks/useTerminalMachine';
import { createClient } from '@/lib/supabase/client';
import type { TerminalMessage } from '@/types';

interface ChatTerminalProps {
  signalId: string;
  hardFacts: string[];
  onRequireAuth: () => void;
  onMessagesChange?: (messages: TerminalMessage[]) => void;
  /** 月度配额耗尽时触发，由父组件弹出升级引导 */
  onQuotaExceeded?: () => void;
  /** 当前界面语言，控制组件内部 UI 文案 */
  lang?: 'cn' | 'en';
}

export default function ChatTerminal({
  signalId,
  hardFacts,
  onRequireAuth,
  onMessagesChange,
  onQuotaExceeded,
  lang = 'cn',
}: ChatTerminalProps) {
  const [inputValue, setInputValue] = useState('');
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const { messages, isStreaming, error, submitInterrogation, clearTerminal } =
    useTerminalMachine({ signalId, hardFacts, onMessagesChange, onQuotaExceeded });

  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isStreaming) return;

    // 🚀 核心拦截逻辑：配额检测
    const { data: { session } } = await supabase.auth.getSession();
    
    // 如果没有登录，且历史消息（用户+AI）已经超过 2 条（即一轮对话）
    if (!session && messages.length >= 2) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🟡 [模块_异步] -> 目标: 探测到匿名用户配额耗尽，阻断 API 泵入');
      }
      onRequireAuth();
      return;
    }

    submitInterrogation(inputValue);
    setInputValue('');
  };

  return (
    <div className="w-full bg-[var(--td-surface-1)] border border-[var(--td-border)] shadow-sm ring-1 ring-[var(--td-ring)] flex flex-col h-[600px] rounded-lg relative overflow-hidden group">
      <div className="flex items-center justify-between p-4 border-b border-[var(--td-border)] bg-zinc-50">
        <div className="flex items-center gap-3">
          <TerminalIcon className="w-5 h-5 text-red-600 group-hover:animate-pulse" />
          <span className="text-xs font-mono text-zinc-600 tracking-widest uppercase">PRO Terminal / {signalId}</span>
        </div>
        <div className="flex items-center gap-4 text-zinc-500">
          <button onClick={clearTerminal} title={lang === 'cn' ? '清除物理内存' : 'Clear Memory'} className="hover:text-red-600 transition-colors flex items-center gap-2 text-xs uppercase tracking-widest font-bold">
            <Trash2 className="w-4 h-4" /> CLEAR
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 font-mono text-sm scrollbar-thin scrollbar-thumb-zinc-300 bg-white">
        {messages.length === 0 && (
          <div className="text-zinc-500 text-xs text-center mt-20 uppercase tracking-[0.2em]">
            <span className="block mb-2 text-red-400">_ SYSTEM STANDBY _</span>
            {lang === 'cn' ? '等待输入核心指令。请基于已查明的硬通货事实进行追问。' : 'Awaiting input. Interrogate based on the confirmed hard facts above.'}
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <span className={`text-[10px] uppercase tracking-[0.2em] mb-2 ${msg.role === 'user' ? 'text-zinc-500' : 'text-red-700 font-bold'}`}>
              {msg.role === 'user' ? 'GUEST_USER' : 'SYSTEM_AI'}
            </span>
            <div className={`p-4 max-w-[90%] md:max-w-[75%] leading-relaxed ${
              msg.role === 'user' ? 'bg-zinc-100 text-zinc-800 border border-zinc-200 rounded-md' : 'bg-transparent text-zinc-800 border-l-2 border-red-500 pl-5 text-base'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 flex items-start gap-3 text-sm rounded-md">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <div ref={endOfMessagesRef} className="h-4" />
      </div>

      <div className="p-4 bg-zinc-50 border-t border-[var(--td-border)]">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <span className="absolute left-4 text-red-600 font-black text-lg">{'>'}</span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isStreaming}
            placeholder={lang === 'cn' ? '输入指令，洞透底层逻辑...' : 'Enter directive to interrogate...'}
            className="w-full bg-white border border-zinc-200 text-zinc-900 font-mono text-base py-4 pl-10 pr-16 placeholder:text-zinc-500 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-colors disabled:opacity-50 rounded-md"
          />
          <button type="submit" disabled={!inputValue.trim() || isStreaming} className="absolute right-4 text-zinc-500 hover:text-red-600 disabled:text-zinc-300 transition-colors bg-white border border-zinc-200 p-2 rounded-md">
            {isStreaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
}