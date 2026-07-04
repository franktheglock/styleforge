import React, { useState, useEffect } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { Sparkles, Settings, Send, RefreshCw, Cpu, X } from 'lucide-react';

export const FloatingAIBar: React.FC = () => {
  const {
    currentDocument,
    aiProviders,
    selectedProviderId,
    setSelectedProviderId,
    loadAIProviders,
    applyAIOperations,
    setSettingsOpen,
  } = useDocumentStore();

  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Floating speech bubble response
  const [aiResponse, setAiResponse] = useState<string | null>(null);

  useEffect(() => {
    loadAIProviders();
  }, []);

  if (!currentDocument) return null;

  const handleSendPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    const userPrompt = prompt;
    setPrompt('');
    setAiResponse(null);
    setIsLoading(true);

    try {
      const reply = await applyAIOperations(userPrompt);
      setAiResponse(reply);
    } catch (err) {
      console.error(err);
      setAiResponse(`Error: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 w-[600px] flex flex-col items-center">
      {/* Speech bubble popup */}
      {aiResponse && (
        <div className="w-full mb-3 bg-[#0d0f14]/95 border border-slate-800 rounded-2xl p-4 shadow-2xl relative animate-in fade-in slide-in-from-bottom-2 duration-200">
          <button
            onClick={() => setAiResponse(null)}
            className="absolute top-3 right-3 p-1 hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X size={12} />
          </button>
          
          <div className="flex gap-2">
            <Sparkles size={14} className="text-orange-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-200 leading-relaxed pr-6 select-text max-h-[150px] overflow-y-auto pr-2">
              {aiResponse}
            </div>
          </div>
        </div>
      )}

      {/* Floating Bar Container */}
      <form 
        onSubmit={handleSendPrompt}
        className={`w-full bg-[#0d0f14]/90 backdrop-blur-md border rounded-full px-4 py-2.5 flex items-center gap-3 shadow-2xl transition-all duration-300
          ${isLoading 
            ? 'border-orange-500/50 shadow-orange-500/5 ring-1 ring-orange-500/20' 
            : 'border-slate-800 hover:border-slate-700/80 shadow-black/40'
          }
        `}
      >
        {/* Glow indicator */}
        <div className="flex items-center justify-center shrink-0">
          {isLoading ? (
            <RefreshCw size={14} className="animate-spin text-orange-400" />
          ) : (
            <Sparkles size={14} className="text-orange-400 animate-pulse" />
          )}
        </div>

        {/* Input prompt */}
        <input
          type="text"
          value={prompt}
          disabled={isLoading}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask StyleForge AI to edit (e.g., 'Move skills above education')..."
          className="flex-1 bg-transparent border-none text-xs text-slate-200 focus:outline-none placeholder-slate-500 disabled:opacity-50"
        />

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Dropdown for model */}
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

          {/* AI Settings gear */}
          <button
            type="button"
            title="Settings"
            onClick={() => setSettingsOpen(true)}
            className="p-1.5 hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Settings size={13} />
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!prompt.trim() || isLoading}
            className="p-1.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:hover:bg-orange-500 text-slate-950 rounded-full transition-colors flex items-center justify-center cursor-pointer shadow-md shrink-0"
          >
            <Send size={12} />
          </button>
        </div>
      </form>

      {/* Settings modal resolves globally */}
    </div>
  );
};
