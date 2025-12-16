import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Loader2 } from 'lucide-react';
import { askPayrollAssistant } from '../services/geminiService';
import { Employee, CalculatedPayroll } from '../types';

interface Props {
  currentEmployee?: Employee;
  payrollData?: CalculatedPayroll;
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'ai';
  content: string;
}

export const AIAssistant: React.FC<Props> = ({ currentEmployee, payrollData, isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: '您好！我是您的薪資與勞基法助手。對於這份薪資單或勞健保計算有任何疑問嗎？' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    const aiResponse = await askPayrollAssistant(userMsg, currentEmployee, payrollData);
    
    setMessages(prev => [...prev, { role: 'ai', content: aiResponse }]);
    setIsLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-slate-200 transform transition-transform duration-300 z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-600 to-indigo-800 text-white">
        <div className="flex items-center gap-2">
          <Bot size={24} />
          <h3 className="font-bold">人資 AI 助手</h3>
        </div>
        <button onClick={onClose} className="hover:bg-white/20 p-1 rounded transition">
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-br-none' 
                  : 'bg-white text-slate-700 shadow-sm border border-slate-100 rounded-bl-none'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white p-3 rounded-2xl rounded-bl-none shadow-sm border border-slate-100">
               <Loader2 className="animate-spin text-indigo-600" size={20} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t border-slate-100">
        <div className="flex gap-2 relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="輸入問題 (例如: 為什麼勞保費是這個金額?)"
            className="w-full pl-4 pr-12 py-3 bg-white text-black border border-black rounded-xl focus:ring-2 focus:ring-indigo-500 resize-none text-sm placeholder-gray-500"
            rows={2}
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 bottom-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="text-xs text-slate-400 mt-2 text-center">
          AI 可能會產生錯誤，重要決策請諮詢專業人士。
        </div>
      </div>
    </div>
  );
};