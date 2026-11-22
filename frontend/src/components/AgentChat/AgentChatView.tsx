import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Square,
  Bot,
  User,
  Sparkles,
  Settings,
  Trash2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ArrowRight,
  Train,
  AlertCircle
} from 'lucide-react';
import type { ChatMessage, AgentConfig, AgentStep, RouteItinerary } from '../../types';
import { streamAgentChat, getStoredAgentConfig } from '../../services/api';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ItineraryCard } from '../ItineraryCard';
import { AgentSettingsModal } from './AgentSettingsModal';

interface AgentChatViewProps {
  onOpenSchedule?: (trainNo: string, trainName: string, boarding: string, alighting: string) => void;
  onOpenCoachLayout?: (trainNo: string, trainName: string) => void;
  onOpenFareBreakdown?: (fare: number, travelClass: string, trainNo: string, trainName: string) => void;
  onOpenWatchdog?: (trainNo: string, trainName: string, fromStn: string, toStn: string, travelClass: string) => void;
  onOpenExportShare?: (itinerary: RouteItinerary) => void;
  onSwitchToOptimizer?: (originCode?: string, destCode?: string, dateStr?: string) => void;
}

const INITIAL_SUGGESTIONS = [
  'Trains from Jhansi to Bangalore on 28 Dec under 1500',
  'From Delhi to Mumbai tomorrow in 3A confirmed only',
  'What is the IRCTC chart preparation time for 18:00 departure?',
  'Compare 5-day seat availability from NDLS to SBC',
];

const LOCAL_STORAGE_MESSAGES_KEY = 'irctc_copilot_chat_history_v1';

export const AgentChatView: React.FC<AgentChatViewProps> = ({
  onOpenSchedule,
  onOpenCoachLayout,
  onOpenFareBreakdown,
  onOpenWatchdog,
  onOpenExportShare,
  onSwitchToOptimizer,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_MESSAGES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: 'msg-welcome',
        role: 'assistant',
        content:
          "👋 **Namaste! I am your Antigravity IRCTC Copilot.**\n\nI can help you find confirmed train tickets, uncover same-train split seats, check tatkal quotas, compare multi-date availability, and track live schedules.\n\nType where you want to travel, or select one of the suggested journeys below!",
        timestamp: Date.now(),
        status: 'done',
        suggestions: INITIAL_SUGGESTIONS,
      },
    ];
  });

  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [config, setConfig] = useState<AgentConfig>(() => getStoredAgentConfig());
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [expandedStepsMap, setExpandedStepsMap] = useState<Record<string, boolean>>({});

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Save messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_MESSAGES_KEY, JSON.stringify(messages.slice(-20)));
    } catch {}
  }, [messages]);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputPrompt]);

  const toggleSteps = (msgId: string) => {
    setExpandedStepsMap((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const handleClearHistory = () => {
    if (window.confirm('Clear conversation history?')) {
      const resetMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: 'Conversation cleared. How can I help with your railway travel today?',
        timestamp: Date.now(),
        status: 'done',
        suggestions: INITIAL_SUGGESTIONS,
      };
      setMessages([resetMsg]);
      localStorage.removeItem(LOCAL_STORAGE_MESSAGES_KEY);
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  const sendMessage = useCallback(
    async (textToSend: string) => {
      const query = textToSend.trim();
      if (!query || isStreaming) return;

      const userMsgId = `user-${Date.now()}`;
      const assistantMsgId = `assistant-${Date.now()}`;

      const userMsg: ChatMessage = {
        id: userMsgId,
        role: 'user',
        content: query,
        timestamp: Date.now(),
        status: 'done',
      };

      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        status: 'streaming',
        steps: [],
        routes: [],
        suggestions: [],
      };

      const updatedHistory = [...messages, userMsg];
      setMessages([...updatedHistory, assistantMsg]);
      setInputPrompt('');
      setIsStreaming(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        await streamAgentChat(
          updatedHistory,
          config,
          {
            onStep: (step: AgentStep) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        steps: [...(m.steps || []), step],
                      }
                    : m
                )
              );
            },
            onDelta: (chunk: string) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: m.content + chunk,
                      }
                    : m
                )
              );
            },
            onComplete: (data) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content: data.text || m.content,
                        steps: data.steps && data.steps.length > 0 ? data.steps : m.steps,
                        routes: data.routes || [],
                        suggestions: data.suggestions || [],
                        status: 'done',
                      }
                    : m
                )
              );
              setIsStreaming(false);
            },
            onError: (err) => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        content:
                          m.content +
                          `\n\n⚠️ *Search assistance error: ${err.message || 'Please try again.'}*`,
                        status: 'error',
                      }
                    : m
                )
              );
              setIsStreaming(false);
            },
          },
          abortController.signal
        );
      } catch (err: any) {
        if (!abortController.signal.aborted) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content:
                      m.content + `\n\n⚠️ *Request failed: ${err.message || 'Connection error'}*`,
                    status: 'error',
                  }
                : m
            )
          );
        }
        setIsStreaming(false);
      }
    },
    [messages, isStreaming, config]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputPrompt);
    }
  };

  const getProviderBadge = () => {
    switch (config.provider) {
      case 'gemini':
        return {
          label: 'Gemini 2.5 Flash',
          color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        };
      case 'openai':
        return {
          label: config.model || 'OpenAI GPT-4o',
          color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        };
      case 'ollama':
        return {
          label: config.model ? `Ollama (${config.model})` : 'Ollama (gemma4:31b)',
          color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        };
      default:
        return {
          label: 'Smart Heuristic Engine',
          color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
        };
    }
  };

  const badge = getProviderBadge();

  return (
    <div className="flex flex-col h-[calc(100dvh-120px)] max-w-4xl mx-auto w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/70 backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="p-1.5 rounded-lg bg-orange-500 text-white shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-zinc-900" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                IRCTC Agent Copilot
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${badge.color}`}
              >
                {badge.label}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors"
            title="Configure LLM Provider & BYOK API Keys"
          >
            <Settings className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Settings</span>
          </button>
          <button
            type="button"
            onClick={handleClearHistory}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Clear Chat History"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const hasSteps = msg.steps && msg.steps.length > 0;
          const isExpanded = !!expandedStepsMap[msg.id];
          const hasRoutes = msg.routes && msg.routes.length > 0;

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                  isUser
                    ? 'bg-zinc-800 text-white dark:bg-zinc-700'
                    : 'bg-orange-600 text-white shadow-xs'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Content Container */}
              <div className={`space-y-2.5 max-w-[85%] sm:max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
                {/* User Message Bubble */}
                {isUser ? (
                  <div className="px-4 py-2.5 rounded-2xl rounded-tr-xs bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs sm:text-sm font-medium shadow-xs">
                    {msg.content}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Tool / Reasoning Steps Accordion */}
                    {hasSteps && (
                      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-800/40 overflow-hidden text-xs">
                        <button
                          type="button"
                          onClick={() => toggleSteps(msg.id)}
                          className="w-full flex items-center justify-between px-3 py-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100/50 dark:hover:bg-zinc-800/60 transition-colors"
                        >
                          <span className="flex items-center gap-1.5 font-medium text-[11px]">
                            <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                            {msg.status === 'streaming'
                              ? 'Engine working on railway search...'
                              : `Engine execution (${msg.steps?.length} steps)`}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="px-3 py-2 space-y-1.5 border-t border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/40">
                            {msg.steps?.map((step, si) => (
                              <div
                                key={si}
                                className="flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-300"
                              >
                                {step.type === 'error' ? (
                                  <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                )}
                                <span className="font-mono text-zinc-400">
                                  {step.toolName ? `[${step.toolName}]` : '•'}
                                </span>
                                <span>{step.label}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Agent Text Bubble */}
                    {msg.content && (
                      <div className="px-4 py-3 rounded-2xl rounded-tl-xs bg-zinc-100/80 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs">
                        <MarkdownRenderer content={msg.content} />
                      </div>
                    )}

                    {/* Streaming Cursor */}
                    {msg.status === 'streaming' && !msg.content && (
                      <div className="flex items-center gap-2 text-xs text-zinc-400 p-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                        <span>Searching Indian Railways live seat availability...</span>
                      </div>
                    )}

                    {/* Embedded Itinerary Cards */}
                    {hasRoutes && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                            <Train className="w-3.5 h-3.5 text-orange-500" />
                            Found Train Itineraries ({msg.routes?.length})
                          </span>
                          {onSwitchToOptimizer && (
                            <button
                              type="button"
                              onClick={() => {
                                const first = msg.routes?.[0];
                                onSwitchToOptimizer(first?.origin, first?.destination);
                              }}
                              className="text-[11px] text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 font-medium"
                            >
                              Open in Optimizer <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <div className="space-y-3">
                          {msg.routes?.slice(0, 5).map((route) => (
                            <div
                              key={route.id}
                              className="transform transition-all hover:translate-y-[-1px]"
                            >
                              <ItineraryCard
                                itinerary={route}
                                fromName={route.origin}
                                toName={route.destination}
                                onOpenSchedule={onOpenSchedule}
                                onOpenCoachLayout={onOpenCoachLayout}
                                onOpenFareBreakdown={onOpenFareBreakdown}
                                onOpenWatchdog={onOpenWatchdog}
                                onOpenExportShare={onOpenExportShare}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick Suggestion Chips */}
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {msg.suggestions.map((sug, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => sendMessage(sug)}
                            className="px-3 py-1 text-xs rounded-full bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:border-orange-500 hover:text-orange-600 dark:hover:text-orange-400 transition-all text-left shadow-2xs cursor-pointer"
                          >
                            💬 {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 sm:p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(inputPrompt);
          }}
          className="relative flex items-end gap-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-2xl p-2 shadow-xs focus-within:ring-2 focus-within:ring-orange-500/50 focus-within:border-orange-500"
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything (e.g. 'Trains from Jhansi to Bangalore on 28 Dec under 1500')..."
            className="flex-1 max-h-32 p-1.5 text-xs sm:text-sm bg-transparent resize-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-hidden"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={handleStopStreaming}
              aria-label="Stop generation"
              className="p-2 rounded-xl bg-zinc-800 dark:bg-zinc-700 text-white hover:bg-zinc-700 transition-colors shrink-0"
              title="Stop response"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!inputPrompt.trim()}
              aria-label="Send message"
              className="p-2 rounded-xl bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-40 disabled:hover:bg-orange-600 transition-colors shrink-0 cursor-pointer"
              title="Send (Enter)"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </form>

        <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-zinc-400">
          <span>Press Enter to send, Shift+Enter for new line</span>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            Model: <span className="font-medium text-orange-500">{config.provider.toUpperCase()}</span>
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      <AgentSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSaveConfig={(newCfg) => setConfig(newCfg)}
      />
    </div>
  );
};
