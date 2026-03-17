import React, { useRef, useEffect, useState } from 'react';
import { Terminal as TerminalIcon, Send, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { useTerminalMachine } from '@/hooks/useTerminalMachine';

interface ChatTerminalProps {
  signalId: string;
  hardFacts: string[];
}

/**
 * 核心业务说明：
 * 沉浸式深度审讯终端。已剥离所有悬浮窗与折叠逻辑。
 * 作为解码报告底部的核心常驻工作区，直接承受用户的高频追问流量。
 */
export default function ChatTerminal({ signalId, hardFacts }: ChatTerminalProps) {
  const [inputValue, setInputValue] = useState('');
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const { messages, isStreaming, error, submitInterrogation, clearTerminal } = useTerminalMachine({ signalId, hardFacts });

  // 核心业务：控制终端在收到新字节流时，永远保持自动滚屏到底部。
  useEffect(() => {
    if (endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isStreaming) return;
    submitInterrogation(inputValue);
    setInputValue('');
  };

  return (
    <div className="w-full bg-black border border-zinc-800 shadow-2xl flex flex-col h-[600px] rounded-sm relative overflow-hidden group">
      {/* 终端头部 */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-3">
          <TerminalIcon className="w-5 h-5 text-red-600 group-hover:animate-pulse" />
          <span className="text-xs font-mono text-zinc-400 tracking-widest uppercase">PRO Terminal / {signalId}</span>
        </div>
        <div className="flex items-center gap-4 text-zinc-500">
          <button onClick={clearTerminal} title="清除物理内存" className="hover:text-red-500 transition-colors flex items-center gap-2 text-xs uppercase tracking-widest font-bold">
            <Trash2 className="w-4 h-4" /> CLEAR
          </button>
        </div>
      </div>

      {/* 消息滚动区 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 font-mono text-sm scrollbar-thin scrollbar-thumb-zinc-800 bg-zinc-950/30">
        {messages.length === 0 && (
          <div className="text-zinc-600 text-xs text-center mt-20 uppercase tracking-[0.2em]">
            <span className="block mb-2 text-red-900/50">_ SYSTEM STANDBY _</span>
            等待输入核心指令。请基于已查明的硬通货事实进行追问。
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <span className={`text-[10px] uppercase tracking-[0.2em] mb-2 ${msg.role === 'user' ? 'text-zinc-600' : 'text-red-700 font-bold'}`}>
              {msg.role === 'user' ? 'GUEST_USER' : 'SYSTEM_AI'}
            </span>
            <div className={`p-4 max-w-[90%] md:max-w-[75%] leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-zinc-900 text-zinc-300 border border-zinc-800 rounded-sm' 
                : 'bg-transparent text-white border-l-2 border-red-700 pl-5 text-base'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        
        {error && (
          <div className="bg-red-950/30 border border-red-900 text-red-500 p-4 flex items-start gap-3 text-sm rounded-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <div ref={endOfMessagesRef} className="h-4" />
      </div>

      {/* 输入区域 */}
      <div className="p-4 bg-zinc-950 border-t border-zinc-800">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <span className="absolute left-4 text-red-600 font-black text-lg">{'>'}</span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isStreaming}
            placeholder="输入指令，洞透底层逻辑..."
            className="w-full bg-black border border-zinc-800 text-white font-mono text-base py-4 pl-10 pr-16 focus:outline-none focus:border-red-800 transition-colors disabled:opacity-50 rounded-sm"
          />
          <button 
            type="submit" 
            disabled={!inputValue.trim() || isStreaming}
            className="absolute right-4 text-zinc-500 hover:text-red-500 disabled:text-zinc-800 transition-colors bg-zinc-900 p-2 rounded-sm"
          >
            {isStreaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </form>
      </div>
    </div>
  );
}