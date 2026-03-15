import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, X, Maximize2, Minimize2, Send, AlertCircle, Loader2, Trash2 } from 'lucide-react';
import { useTerminalMachine } from '@/hooks/useTerminalMachine';

interface ChatTerminalProps {
  signalId: string;
  hardFacts: string[];
}

export default function ChatTerminal({ signalId, hardFacts }: ChatTerminalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  const { messages, isStreaming, error, submitInterrogation, clearTerminal } = useTerminalMachine({ signalId, hardFacts });

  // 核心业务说明：控制终端在收到新字节流时，永远保持自动滚屏到底部。
  useEffect(() => {
    if (isOpen && endOfMessagesRef.current) {
      endOfMessagesRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isStreaming) return;
    submitInterrogation(inputValue);
    setInputValue('');
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-red-700 hover:bg-red-600 text-white p-4 rounded-full shadow-[0_0_20px_rgba(185,28,28,0.4)] transition-all group z-50 flex items-center gap-3"
      >
        <TerminalIcon className="w-6 h-6 group-hover:animate-pulse" />
        <span className="font-black uppercase tracking-widest text-xs hidden group-hover:block pr-2">深度审讯</span>
      </button>
    );
  }

  return (
    <div 
      className={`fixed right-0 md:right-6 bottom-0 md:bottom-6 z-50 bg-black border border-zinc-800 shadow-2xl flex flex-col transition-all duration-300 ${
        isExpanded ? 'w-full md:w-[800px] h-[100vh] md:h-[80vh] md:rounded-sm' : 'w-full md:w-[400px] h-[600px] md:rounded-sm'
      }`}
    >
      {/* 终端头部 */}
      <div className="flex items-center justify-between p-3 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-red-600" />
          <span className="text-[10px] font-mono text-zinc-400 tracking-widest uppercase">PRO Terminal / {signalId}</span>
        </div>
        <div className="flex items-center gap-3 text-zinc-500">
          <button onClick={clearTerminal} title="清空会话" className="hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
          <button onClick={() => setIsExpanded(!isExpanded)} className="hover:text-white transition-colors">
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button onClick={() => setIsOpen(false)} className="hover:text-red-500 transition-colors"><X className="w-5 h-5" /></button>
        </div>
      </div>

      {/* 消息滚动区 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 font-mono text-sm scrollbar-thin scrollbar-thumb-zinc-800">
        {messages.length === 0 && (
          <div className="text-zinc-600 text-xs text-center mt-10 uppercase tracking-widest">
            系统提示：基于已知事实提问。
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <span className={`text-[9px] uppercase tracking-widest mb-1 ${msg.role === 'user' ? 'text-zinc-500' : 'text-red-700'}`}>
              {msg.role === 'user' ? 'GUEST_USER' : 'SYSTEM_AI'}
            </span>
            <div className={`p-3 max-w-[85%] leading-relaxed ${
              msg.role === 'user' ? 'bg-zinc-900 text-zinc-300 border border-zinc-800' : 'bg-transparent text-white border-l-2 border-red-700 pl-4'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        
        {error && (
          <div className="bg-red-950/30 border border-red-900 text-red-500 p-3 flex items-start gap-2 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      {/* 输入区域 */}
      <div className="p-3 bg-zinc-950 border-t border-zinc-800">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <span className="absolute left-3 text-red-600 font-black">{'>'}</span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isStreaming}
            placeholder="输入指令进行追问..."
            className="w-full bg-black border border-zinc-800 text-white font-mono text-sm py-3 pl-8 pr-12 focus:outline-none focus:border-red-800 transition-colors disabled:opacity-50"
          />
          <button 
            type="submit" 
            disabled={!inputValue.trim() || isStreaming}
            className="absolute right-3 text-zinc-500 hover:text-red-500 disabled:text-zinc-800 transition-colors"
          >
            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}