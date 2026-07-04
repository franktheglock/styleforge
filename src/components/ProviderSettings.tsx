import React, { useState, useEffect } from 'react';
import { useDocumentStore } from '../store/documentStore';
import { AIProviderConfig, AIProviderType } from '../types';
import { Settings, Save, AlertCircle, Sparkles } from 'lucide-react';

interface ProviderSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProviderSettings: React.FC<ProviderSettingsProps> = ({ isOpen, onClose }) => {
  const { aiProviders, saveAIProvider, loadAIProviders } = useDocumentStore();
  const [selectedProvider, setSelectedProvider] = useState<AIProviderConfig | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [providerType, setProviderType] = useState<AIProviderType>('Ollama');
  const [endpoint, setEndpoint] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadAIProviders();
    }
  }, [isOpen]);

  useEffect(() => {
    if (aiProviders.length > 0) {
      // Default to selecting the default provider or the first one
      const active = aiProviders.find(p => p.isDefault) || aiProviders[0];
      handleSelectProvider(active);
    }
  }, [aiProviders]);

  const handleSelectProvider = (prov: AIProviderConfig) => {
    setSelectedProvider(prov);
    setName(prov.name);
    setProviderType(prov.providerType);
    setEndpoint(prov.endpoint);
    setApiKey(prov.apiKey);
    setModelName(prov.modelName);
    setTemperature(prov.temperature);
    setMaxTokens(prov.maxTokens);
    setIsDefault(prov.isDefault);
    setError('');
    setSuccess(false);
  };

  const handleCreateNew = () => {
    setSelectedProvider(null);
    setName('New Provider');
    setProviderType('Ollama');
    setEndpoint('http://localhost:11434');
    setApiKey('');
    setModelName('llama3');
    setTemperature(0.2);
    setMaxTokens(2048);
    setIsDefault(false);
    setError('');
    setSuccess(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (!name.trim()) {
      setError('Provider name is required.');
      return;
    }
    if (!endpoint.trim()) {
      setError('API endpoint is required.');
      return;
    }

    const payload: AIProviderConfig = {
      id: selectedProvider?.id || `prov_local_${Date.now()}`,
      name,
      providerType,
      endpoint,
      apiKey,
      modelName,
      temperature,
      maxTokens,
      isDefault
    };

    try {
      await saveAIProvider(payload);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save AI configuration settings.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm text-xs select-text">
      <div className="bg-[#0b0f19] border border-slate-800 rounded-lg w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-2 bg-[#0e1325] rounded-t-lg">
          <Settings size={16} className="text-indigo-400" />
          <span className="text-sm font-semibold text-slate-200">AI Provider Configurations</span>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden min-h-[400px]">
          {/* Left panel: List of Providers */}
          <div className="w-1/3 border-r border-slate-800 bg-[#070a13] p-4 flex flex-col gap-2 overflow-y-auto">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mb-2">Saved Configurations</span>
            
            {aiProviders.map((prov) => (
              <button
                key={prov.id}
                onClick={() => handleSelectProvider(prov)}
                className={`w-full px-3 py-2.5 rounded text-left flex flex-col gap-1 transition-colors
                  ${selectedProvider?.id === prov.id
                    ? 'bg-indigo-600 text-white'
                    : 'hover:bg-slate-900 bg-slate-950/30 text-slate-300 border border-slate-900 hover:border-slate-800'
                  }
                `}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold truncate">{prov.name}</span>
                  {prov.isDefault && (
                    <span className={`text-[8px] font-mono px-1 rounded
                      ${selectedProvider?.id === prov.id ? 'bg-white/20 text-white' : 'bg-indigo-500/20 text-indigo-300'}
                    `}>
                      Default
                    </span>
                  )}
                </div>
                <span className={`text-[9px] font-mono ${selectedProvider?.id === prov.id ? 'text-indigo-200' : 'text-slate-500'}`}>
                  {prov.providerType}
                </span>
              </button>
            ))}

            <button
              onClick={handleCreateNew}
              className="w-full mt-4 border border-dashed border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 px-3 py-2 rounded text-center transition-colors"
            >
              + Create New Profile
            </button>
          </div>

          {/* Right panel: Editor Form */}
          <form onSubmit={handleSave} className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto bg-[#0b0f19]">
            <h3 className="font-semibold text-slate-200 text-xs">
              {selectedProvider ? `Edit ${selectedProvider.name}` : 'Configure New AI Provider'}
            </h3>

            {error && (
              <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 flex items-start gap-2">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-start gap-2">
                <Sparkles size={14} className="mt-0.5 shrink-0" />
                <span>AI configuration settings saved successfully!</span>
              </div>
            )}

            {/* Provider Type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-400 font-semibold">Provider Type</label>
                <select
                  value={providerType}
                  onChange={(e) => {
                    const type = e.target.value as AIProviderType;
                    setProviderType(type);
                    // Autofill endpoints if creating new
                    if (!selectedProvider) {
                      if (type === 'Ollama') setEndpoint('http://localhost:11434');
                      if (type === 'LMStudio') setEndpoint('http://localhost:1234/v1');
                      if (type === 'LlamaCpp') setEndpoint('http://localhost:8080');
                      if (type === 'OpenRouter') setEndpoint('https://openrouter.ai/api/v1');
                      if (type === 'NvidiaNim') setEndpoint('https://integrate.api.nvidia.com/v1');
                    }
                  }}
                  className="bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="Ollama">Ollama (Local)</option>
                  <option value="LMStudio">LM Studio (Local Server)</option>
                  <option value="LlamaCpp">Llama.cpp (Local Server)</option>
                  <option value="OpenRouter">OpenRouter (Cloud API)</option>
                  <option value="NvidiaNim">NVIDIA NIM (Cloud API)</option>
                  <option value="Custom">Custom OpenAI-Compat</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-slate-400 font-semibold">Config Label</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Local Llama 3"
                  className="bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Endpoint */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 font-semibold">API Endpoint</label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                placeholder="e.g. http://localhost:11434"
                className="bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            {/* API Key (if OpenRouter, NIM, etc.) */}
            {(providerType === 'OpenRouter' || providerType === 'NvidiaNim' || providerType === 'Custom') && (
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-400 font-semibold">API Key / Token</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Bearer token"
                  className="bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            )}

            {/* Model Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-400 font-semibold">Model Name (exactly as expected by backend)</label>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="e.g. llama3 or meta-llama/llama-3-8b-instruct"
                className="bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            {/* Model Hyperparameters */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-400 font-semibold">Temperature: {temperature}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="bg-slate-800 h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500 my-2"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-slate-400 font-semibold">Max Tokens</label>
                <input
                  type="number"
                  min="128"
                  max="32768"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
                  className="bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            {/* Default config checkbox */}
            <div className="flex items-center gap-2 py-2">
              <input
                type="checkbox"
                id="is-default"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-slate-800 text-indigo-600 focus:ring-indigo-500 bg-slate-900 h-4 w-4"
              />
              <label htmlFor="is-default" className="text-slate-400 font-semibold select-none cursor-pointer">
                Set as default provider for document editing tasks
              </label>
            </div>

            {/* Form Actions */}
            <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-850 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-slate-800 hover:bg-slate-900 rounded font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                Close
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-medium flex items-center gap-1.5 shadow-md transition-colors"
              >
                <Save size={14} /> Save Configuration
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
