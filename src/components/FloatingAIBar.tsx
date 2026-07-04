import React, { useState, useEffect, useRef } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { Sparkles, Settings, Send, RefreshCw, Cpu, Bot, User, X } from 'lucide-react';
import { marked } from 'marked';
import { invoke } from '@tauri-apps/api/core';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

export const FloatingAIBar: React.FC = () => {
  const {
    currentDocument,
    aiProviders,
    selectedProviderId,
    setSelectedProviderId,
    loadAIProviders,
    setSettingsOpen,
  } = useDocumentStore();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isOpen, setIsOpen] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAIProviders();
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  if (!currentDocument) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !selectedProviderId) return;

    const userText = input.trim();
    setInput('');
    const userMsg: Msg = { role: 'user', content: userText };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const conversation = [...messages, userMsg];

      // Set up streaming listener BEFORE invoke to avoid missing early tokens
      let accumulated = '';
      const { listen } = await import('@tauri-apps/api/event');
      const unlistenToken = await listen<string>('ai-stream:token', (event) => {
        accumulated += event.payload;
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === 'assistant') {
            copy[copy.length - 1] = { ...last, content: accumulated };
          }
          return copy;
        });
      });

      // Add a placeholder assistant message for streaming
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      // Start the streaming command; it emits ai-stream:token / ai-stream:done events
      const payloadPromise: Promise<{ document: any; assistantMessage: string }> = invoke('stream_ai_operations', {
        doc: currentDocument,
        messages: conversation.map((m) => ({ role: m.role, content: m.content })),
        providerId: selectedProviderId,
      });

      const payload = await payloadPromise;
      unlistenToken();

      // Update the document store with the result
      if (payload.document) {
        useDocumentStore.setState({ currentDocument: payload.document });
      }

      // Finalize with the full response
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === 'assistant') {
          copy[copy.length - 1] = { role: 'assistant', content: payload.assistantMessage || accumulated || 'Done!' };
        }
        return copy;
      });
    } catch (err) {
      console.error(err);
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === 'assistant' && !last.content) {
          copy[copy.length - 1] = { role: 'assistant', content: `Error: ${err}` };
        } else {
          copy.push({ role: 'assistant', content: `Error: ${err}` });
        }
        return copy;
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-[600px] flex flex-col items-center">
      {/* Chat log */}
      {messages.length > 0 && (
        <div
          ref={listRef}
          className="w-full mb-3 bg-[#0d0f14]/95 border border-slate-800 rounded-2xl p-3 shadow-2xl max-h-[400px] overflow-y-auto space-y-2 relative"
        >
          {/* Close chat button */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-2 right-2 p-1 hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-300 transition-colors z-10"
            title="Close AI bar"
          >
            <X size={12} />
          </button>

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === 'assistant' ? '' : 'flex-row-reverse'}`}>
              <div className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                msg.role === 'assistant' ? 'bg-orange-500/20 text-orange-400' : 'bg-indigo-500/20 text-indigo-400'
              }`}>
                {msg.role === 'assistant' ? <Bot size={12} /> : <User size={12} />}
              </div>
              <div className={`max-w-[85%] px-3 py-1.5 rounded-lg text-xs leading-relaxed select-text ${
                msg.role === 'assistant'
                  ? 'bg-slate-900/80 text-slate-200 border border-slate-800'
                  : 'bg-indigo-500/10 text-indigo-200 border border-indigo-500/20'
              }`}>
                {msg.role === 'assistant' && !msg.content ? (
                  <RefreshCw size={12} className="animate-spin text-slate-400" />
                ) : (
                  <div className="prose-markdown" dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) }} />
                )}
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-2">
              <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-orange-500/20 text-orange-400">
                <Bot size={12} />
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800">
                <RefreshCw size={12} className="animate-spin text-slate-400" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Bar Container */}
      <form 
        onSubmit={handleSend}
        className={`w-full bg-[#0d0f14]/90 backdrop-blur-md border rounded-full px-4 py-2.5 flex items-center gap-3 shadow-2xl transition-all duration-300
          ${isLoading 
            ? 'border-orange-500/50 shadow-orange-500/5 ring-1 ring-orange-500/20' 
            : 'border-slate-800 hover:border-slate-700/80 shadow-black/40'
          }
        `}
      >
        <div className="flex items-center justify-center shrink-0">
          {isLoading ? (
            <RefreshCw size={14} className="animate-spin text-orange-400" />
          ) : (
            <Sparkles size={14} className="text-orange-400 animate-pulse" />
          )}
        </div>

        <input
          type="text"
          value={input}
          disabled={isLoading}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask StyleForge AI to edit..."
          className="flex-1 bg-transparent border-none text-xs text-slate-200 focus:outline-none placeholder-slate-500 disabled:opacity-50"
        />

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-850 rounded-full px-2.5 py-1">
            <Cpu size={10} className="text-slate-500" />
            <select
              value={selectedProviderId || ''}
              onChange={(e) => setSelectedProviderId(e.target.value || null)}
              className="bg-transparent text-[9px] text-slate-400 focus:outline-none max-w-[100px] font-mono cursor-pointer"
            >
              {aiProviders.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-950 text-slate-300">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            title="Settings"
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Settings size={13} />
          </button>

          <button
            type="submit"
            disabled={!input.trim() || isLoading || !selectedProviderId}
            className="p-1.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:hover:bg-orange-500 text-slate-950 rounded-full transition-colors flex items-center justify-center cursor-pointer shadow-md shrink-0"
          >
            <Send size={12} />
          </button>
        </div>
      </form>
    </div>
  );
};
