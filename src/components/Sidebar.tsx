import React, { useState, useEffect, useRef } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { ProviderSettings } from './ProviderSettings';
import { Sparkles, Settings, Send, RefreshCw, Cpu } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    currentDocument,
    aiProviders,
    selectedProviderId,
    setSelectedProviderId,
    loadAIProviders,
    applyAIOperations,
  } = useDocumentStore();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [chatPrompt, setChatPrompt] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant' | 'system', content: string }>>([
    { role: 'assistant', content: 'Hello! I am your StyleForge assistant. Tell me what changes you would like to make to the document structure, and I will execute them.' }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAIProviders();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLoading]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatPrompt.trim() || !currentDocument || isLoading) return;

    const userMsg = chatPrompt;
    setChatPrompt('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const conversation = [...chatHistory, { role: 'user' as const, content: userMsg }];
      const reply = await applyAIOperations(conversation);
      setChatHistory(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      console.error(err);
      setChatHistory(prev => [...prev, { role: 'assistant', content: `Sorry, I encountered an error: ${err}` }]);
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="w-[340px] h-full border-r border-slate-800 bg-[#0d0f14] flex flex-col shrink-0 text-xs text-slate-300 select-none">
      {/* AI Assistant Sidebar (Chat Panel) - Full Height */}
      <div className="flex-1 flex flex-col bg-[#0d0f14] select-none h-full">
        {/* Chat Header */}
        <div className="px-4 h-12 border-b border-slate-800 flex items-center gap-2 bg-[#121620]/60 shrink-0">
          <Sparkles size={14} className="text-orange-400" />
          <span className="font-semibold text-slate-200">AI Assistant</span>

          {/* Model selection */}
          <div className="ml-auto flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded px-2 py-0.5">
            <Cpu size={10} className="text-slate-500" />
            <select
              value={selectedProviderId || ''}
              onChange={(e) => setSelectedProviderId(e.target.value || null)}
              className="bg-transparent text-[10px] text-slate-400 focus:outline-none max-w-[120px] font-mono cursor-pointer"
            >
              {aiProviders.map(p => (
                <option key={p.id} value={p.id} className="bg-slate-950 text-slate-300">{p.name}</option>
              ))}
            </select>
          </div>

          <button
            title="AI Settings"
            onClick={() => setIsSettingsOpen(true)}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors shrink-0"
          >
            <Settings size={14} />
          </button>
        </div>

        {/* Chat History View */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 select-text">
          {chatHistory.map((msg, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg max-w-[88%] text-[11px] leading-relaxed shadow-sm border
                ${msg.role === 'user'
                  ? 'bg-orange-500/10 border-orange-500/20 text-orange-200 ml-auto'
                  : 'bg-slate-900/50 border-slate-800 text-slate-300'
                }
              `}
            >
              {msg.content}
            </div>
          ))}
          {isLoading && (
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 text-slate-400 flex items-center gap-2 text-[11px] max-w-[88%]">
              <RefreshCw size={12} className="animate-spin text-orange-400" />
              <span>Analyzing document & editing...</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Form */}
        <form onSubmit={handleSendChat} className="p-3 border-t border-slate-800 bg-[#07090f] flex gap-2 shrink-0">
          <input
            type="text"
            disabled={!currentDocument || isLoading}
            value={chatPrompt}
            onChange={(e) => setChatPrompt(e.target.value)}
            placeholder={currentDocument ? "e.g., Move skills above education..." : "Open a document to chat..."}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500 disabled:opacity-40"
          />
          <button
            type="submit"
            disabled={!chatPrompt.trim() || !currentDocument || isLoading}
            className="p-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:hover:bg-orange-500 text-slate-950 rounded-lg shadow transition-colors flex items-center justify-center shrink-0 cursor-pointer"
          >
            <Send size={13} />
          </button>
        </form>
      </div>

      {/* Settings Modal */}
      <ProviderSettings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
};
