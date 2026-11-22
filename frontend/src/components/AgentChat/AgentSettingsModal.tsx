import React, { useState, useEffect } from 'react';
import { X, Key, Cpu, Globe, Check, ShieldCheck, Sparkles } from 'lucide-react';
import type { AgentConfig, AgentProviderOption, LLMProviderId } from '../../types';
import { fetchAgentProviders, saveStoredAgentConfig } from '../../services/api';

interface AgentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AgentConfig;
  onSaveConfig: (newConfig: AgentConfig) => void;
}

export const AgentSettingsModal: React.FC<AgentSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [providers, setProviders] = useState<AgentProviderOption[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<LLMProviderId>(config.provider || 'auto');
  const [apiKey, setApiKey] = useState<string>(config.apiKey || '');
  const [model, setModel] = useState<string>(config.model || '');
  const [endpoint, setEndpoint] = useState<string>(config.endpoint || '');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedProvider(config.provider || 'auto');
      setApiKey(config.apiKey || '');
      setModel(config.model || '');
      setEndpoint(config.endpoint || '');
      setIsSaved(false);

      fetchAgentProviders().then((res) => {
        if (res && res.length > 0) {
          setProviders(res);
        }
      });
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const currentProviderInfo = providers.find((p) => p.id === selectedProvider);

  const handleProviderSelect = (pid: LLMProviderId) => {
    setSelectedProvider(pid);
    const prov = providers.find((p) => p.id === pid);
    if (prov) {
      if (prov.models && prov.models.length > 0) {
        setModel(prov.models[0]);
      } else {
        setModel('');
      }
      if (prov.endpointDefault) {
        setEndpoint(prov.endpointDefault);
      } else {
        setEndpoint('');
      }
    }
  };

  const handleSave = () => {
    const updated: AgentConfig = {
      provider: selectedProvider,
      apiKey: apiKey.trim(),
      model: model.trim(),
      endpoint: endpoint.trim(),
    };
    saveStoredAgentConfig(updated);
    onSaveConfig(updated);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 500);
  };

  const handleResetToAuto = () => {
    setSelectedProvider('auto');
    setApiKey('');
    setModel('');
    setEndpoint('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-labelledby="agent-settings-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 id="agent-settings-title" className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                AI Copilot Engine Settings
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Choose your LLM provider or bring your own API key
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Privacy Callout */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <span className="font-semibold">Privacy First:</span> Your API keys are stored solely in your local browser storage and are transmitted directly only to query the model.
            </div>
          </div>

          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Inference Provider
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleProviderSelect('auto')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedProvider === 'auto'
                    ? 'border-orange-500 bg-orange-500/5 dark:bg-orange-500/10 text-zinc-900 dark:text-zinc-100 ring-1 ring-orange-500'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-orange-500" /> Free Engine
                  </span>
                  {selectedProvider === 'auto' && <Check className="w-3.5 h-3.5 text-orange-500" />}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                  No API key required. Heuristic railway search & tools.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleProviderSelect('gemini')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedProvider === 'gemini'
                    ? 'border-orange-500 bg-orange-500/5 dark:bg-orange-500/10 text-zinc-900 dark:text-zinc-100 ring-1 ring-orange-500'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">Google Gemini</span>
                  {selectedProvider === 'gemini' && <Check className="w-3.5 h-3.5 text-orange-500" />}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                  Gemini 2.5 Flash / Pro via Google AI Studio.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleProviderSelect('openai')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedProvider === 'openai'
                    ? 'border-orange-500 bg-orange-500/5 dark:bg-orange-500/10 text-zinc-900 dark:text-zinc-100 ring-1 ring-orange-500'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">OpenAI</span>
                  {selectedProvider === 'openai' && <Check className="w-3.5 h-3.5 text-orange-500" />}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                  GPT-4o / GPT-4o-mini via OpenAI API key.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleProviderSelect('ollama')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedProvider === 'ollama'
                    ? 'border-orange-500 bg-orange-500/5 dark:bg-orange-500/10 text-zinc-900 dark:text-zinc-100 ring-1 ring-orange-500'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">Ollama / Cloud</span>
                  {selectedProvider === 'ollama' && <Check className="w-3.5 h-3.5 text-orange-500" />}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                  Local or cloud OpenAI-compatible server.
                </p>
              </button>
            </div>
          </div>

          {/* Conditional Key / Model Inputs */}
          {selectedProvider !== 'auto' && (
            <div className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
              {/* API Key */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-zinc-400" />
                    {selectedProvider === 'gemini'
                      ? 'Gemini API Key'
                      : selectedProvider === 'openai'
                      ? 'OpenAI API Key'
                      : 'API Key (Optional for Local Ollama)'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    {showKey ? 'Hide' : 'Show'}
                  </button>
                </div>
                <input
                  type={showKey ? 'text' : 'password'}
                  placeholder={
                    selectedProvider === 'gemini'
                      ? 'AIzaSy...'
                      : selectedProvider === 'openai'
                      ? 'sk-...'
                      : 'ollama / optional'
                  }
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              {/* Endpoint for Ollama / Custom */}
              {selectedProvider === 'ollama' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-zinc-400" /> Endpoint URL
                  </label>
                  <input
                    type="text"
                    placeholder="http://localhost:11434/v1"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-orange-500/50"
                  />
                  <p className="text-[10px] text-zinc-500">
                    Supports any OpenAI-compatible base URL (Local Ollama, vLLM, OpenRouter, Cloud Ollama).
                  </p>
                </div>
              )}

              {/* Model Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Model Identifier
                </label>
                {currentProviderInfo?.models && currentProviderInfo.models.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {currentProviderInfo.models.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setModel(m)}
                        className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                          model === m
                            ? 'bg-orange-500 text-white border-orange-500 font-medium'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                ) : null}
                <input
                  type="text"
                  placeholder="Custom model name (e.g. llama3.2, mistral)"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full mt-1.5 px-3.5 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:outline-hidden focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <button
            type="button"
            onClick={handleResetToAuto}
            className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            Reset to Default
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-orange-600 hover:bg-orange-500 text-white shadow-xs transition-colors flex items-center gap-1.5"
            >
              {isSaved ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Saved!
                </>
              ) : (
                'Save Settings'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
