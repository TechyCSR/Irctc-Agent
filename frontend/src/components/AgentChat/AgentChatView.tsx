import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Square,
  Plus,
  Trash2,
  Menu,
  X,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Zap,
  Wrench,
  Copy,
  Check,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  TrainFront,
  Compass,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
} from 'lucide-react';
import type { ChatMessage, ChatSession, AgentStep, RouteItinerary } from '../../types';
import { streamAgentChat } from '../../services/api';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ItineraryCard } from '../ItineraryCard';
import { ToolExecutionModal } from './ToolExecutionModal';

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
  'What are the Tatkal booking timings and refund rules?',
  'Compare 5-day seat availability from NDLS to SBC',
];

const SESSIONS_STORAGE_KEY = 'irctc_copilot_sessions_v2';
const ACTIVE_SESSION_STORAGE_KEY = 'irctc_copilot_active_session_id';
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'irctc_sidebar_collapsed';

function getDynamicGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatISTTime(timestamp?: number): string {
  if (!timestamp) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(timestamp));
}

function createDefaultWelcomeMessage(): ChatMessage {
  const greeting = getDynamicGreeting();
  return {
    id: `welcome-${Date.now()}`,
    role: 'assistant',
    content:
      `👋 **Namaste and ${greeting}! I am IRCTC AGENT.**\n\nI am your autonomous Indian Railways AI assistant. Powered by real-time train intelligence and deep rail search algorithms, I can help you:\n\n• 🎫 **Discover Confirmed Tickets:** Direct trains, same-train split-seat hacks, and alternate boarding routes.\n• ⚡ **Tatkal & Quotas:** Tatkal opening timings, Premium Tatkal surge rules, Ladies, and Senior Citizen quotas.\n• 🕒 **Timetables & Halts:** Live schedules, intermediate stops, and platform numbers.\n• 📋 **IRCTC Rules & Guidance:** Cancellation charges, refund rules, RAC rules, and luggage allowances.\n\nType where you want to travel, or select one of the suggested journeys below!`,
    timestamp: Date.now(),
    status: 'done',
    suggestions: INITIAL_SUGGESTIONS,
  };
}

function createNewSessionObject(title = 'New Travel Query'): ChatSession {
  const id = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  return {
    id,
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [createDefaultWelcomeMessage()],
  };
}

export const AgentChatView: React.FC<AgentChatViewProps> = ({
  onOpenSchedule,
  onOpenCoachLayout,
  onOpenFareBreakdown,
  onOpenWatchdog,
  onOpenExportShare,
  onSwitchToOptimizer,
}) => {
  // Load saved sessions from localStorage
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    try {
      const stored = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    const defaultSess = createNewSessionObject('Welcome to IRCTC AGENT');
    return [defaultSess];
  });

  // Active session ID
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    try {
      const storedId = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
      if (storedId && sessions.some((s) => s.id === storedId)) {
        return storedId;
      }
    } catch {}
    return sessions[0]?.id || '';
  });

  const [inputPrompt, setInputPrompt] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false); // Mobile drawer
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Tool Inspector Modal
  const [selectedModalSteps, setSelectedModalSteps] = useState<AgentStep[] | null>(null);

  // ChatGPT-style actions feedback
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, 'up' | 'down'>>({});

  // Real-time live Indian Standard Time clock
  const [currentTimeIST, setCurrentTimeIST] = useState<string>('');

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Active session object
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const messages = activeSession?.messages || [];

  // Live IST Clock interval
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(now);
      setCurrentTimeIST(formatted);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Persist sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
      if (activeSessionId) {
        localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, activeSessionId);
      }
    } catch {}
  }, [sessions, activeSessionId]);

  // Persist sidebar collapsed state
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(isSidebarCollapsed));
    } catch {}
  }, [isSidebarCollapsed]);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [inputPrompt]);

  const handleCreateNewSession = () => {
    const newSess = createNewSessionObject('New Travel Chat');
    setSessions((prev) => [newSess, ...prev]);
    setActiveSessionId(newSess.id);
    setIsSidebarOpen(false);
  };

  const handleDeleteSession = (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      const fresh = createNewSessionObject('New Travel Chat');
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
      return;
    }

    const filtered = sessions.filter((s) => s.id !== idToDelete);
    setSessions(filtered);
    if (activeSessionId === idToDelete) {
      setActiveSessionId(filtered[0].id);
    }
  };

  const handleClearCurrentChat = () => {
    if (window.confirm('Clear messages in this conversation?')) {
      const resetMsg = createDefaultWelcomeMessage();
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, messages: [resetMsg], updatedAt: Date.now() }
            : s
        )
      );
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleCopyMessage = (content: string, msgId: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 1800);
  };

  const handleFeedback = (msgId: string, type: 'up' | 'down') => {
    setFeedback((prev) => ({
      ...prev,
      [msgId]: prev[msgId] === type ? undefined : (type as any),
    }));
  };

  const sendMessage = useCallback(
    async (textToSend: string) => {
      const query = textToSend.trim();
      if (!query || isStreaming || !activeSession) return;

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

      const currentMessages = activeSession.messages;
      const updatedHistory = [...currentMessages, userMsg];

      const sessionTitle =
        activeSession.title === 'Welcome to IRCTC AGENT' ||
        activeSession.title === 'Welcome to Copilot' ||
        activeSession.title === 'New Travel Chat'
          ? query.length > 30
            ? query.substring(0, 30) + '...'
            : query
          : activeSession.title;

      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id
            ? {
                ...s,
                title: sessionTitle,
                updatedAt: Date.now(),
                messages: [...updatedHistory, assistantMsg],
              }
            : s
        )
      );

      setInputPrompt('');
      setIsStreaming(true);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        await streamAgentChat(
          updatedHistory,
          {
            onStep: (step: AgentStep) => {
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === activeSession.id
                    ? {
                        ...s,
                        messages: s.messages.map((m) =>
                          m.id === assistantMsgId
                            ? {
                                ...m,
                                steps: [...(m.steps || []), step],
                              }
                            : m
                        ),
                      }
                    : s
                )
              );
            },
            onDelta: (chunk: string) => {
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === activeSession.id
                    ? {
                        ...s,
                        messages: s.messages.map((m) =>
                          m.id === assistantMsgId
                            ? {
                                ...m,
                                content: m.content + chunk,
                              }
                            : m
                        ),
                      }
                    : s
                )
              );
            },
            onComplete: (data) => {
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === activeSession.id
                    ? {
                        ...s,
                        updatedAt: Date.now(),
                        messages: s.messages.map((m) =>
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
                        ),
                      }
                    : s
                )
              );
              setIsStreaming(false);
              abortControllerRef.current = null;
            },
            onError: (err: Error) => {
              setSessions((prev) =>
                prev.map((s) =>
                  s.id === activeSession.id
                    ? {
                        ...s,
                        messages: s.messages.map((m) =>
                          m.id === assistantMsgId
                            ? {
                                ...m,
                                content:
                                  m.content ||
                                  `\n\n⚠️ *Search assistance error: ${err.message || 'Connection timeout'}*`,
                                status: 'error',
                              }
                            : m
                        ),
                      }
                    : s
                )
              );
              setIsStreaming(false);
              abortControllerRef.current = null;
            },
          },
          activeSession.id,
          undefined,
          abortController.signal
        );
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === activeSession.id
                ? {
                    ...s,
                    messages: s.messages.map((m) =>
                      m.id === assistantMsgId
                        ? {
                            ...m,
                            content:
                              m.content ||
                              '⚠️ *Network connection error. Please verify your connection.*',
                            status: 'error',
                          }
                        : m
                    ),
                  }
                : s
            )
          );
        }
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [activeSession, isStreaming]
  );

  const handleRegenerate = () => {
    if (isStreaming) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMsg) {
      sendMessage(lastUserMsg.content);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputPrompt);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-zinc-100/50 dark:bg-zinc-950/60 relative">
      {/* Tool Execution Inspector Modal */}
      <ToolExecutionModal
        isOpen={Boolean(selectedModalSteps)}
        onClose={() => setSelectedModalSteps(null)}
        steps={selectedModalSteps || []}
      />

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs sm:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Collapsible History Sidebar */}
      <aside
        className={`fixed sm:static inset-y-0 left-0 z-40 flex flex-col bg-zinc-50 dark:bg-zinc-900/90 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
          isSidebarOpen ? 'translate-x-0 w-72' : '-translate-x-full sm:translate-x-0'
        } ${
          isSidebarCollapsed ? 'sm:w-0 sm:border-r-0 sm:opacity-0' : 'sm:w-64 md:w-72 sm:opacity-100'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCreateNewSession}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-orange-600 hover:bg-orange-700 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Travel Chat</span>
          </button>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="sm:hidden p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
          <div className="px-2 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
            Recent Conversations
          </div>

          {sessions.map((sess) => {
            const isCurrent = sess.id === activeSessionId;
            return (
              <div
                key={sess.id}
                onClick={() => {
                  setActiveSessionId(sess.id);
                  setIsSidebarOpen(false);
                }}
                className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-medium cursor-pointer transition-all ${
                  isCurrent
                    ? 'bg-white dark:bg-zinc-800 text-orange-600 dark:text-orange-400 shadow-2xs font-semibold border border-zinc-200/80 dark:border-zinc-700'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isCurrent ? 'text-orange-500' : 'text-zinc-400'
                    }`}
                  />
                  <span className="truncate">{sess.title}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDeleteSession(sess.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-opacity"
                  title="Delete Chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>IRCTC Live Engine</span>
          </span>
          <span className="font-mono text-[10px]">
            {sessions.length} {sessions.length === 1 ? 'thread' : 'threads'}
          </span>
        </div>
      </aside>

      {/* Main Full-Screen Chat View */}
      <section className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-950 overflow-hidden relative">
        {/* Top Chat Header Bar */}
        <header className="flex items-center justify-between px-3 sm:px-5 py-3 border-b border-zinc-200 dark:border-zinc-800/80 shrink-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Sidebar Toggle Button */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="sm:hidden p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Open Chat History"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Desktop Sidebar Collapse / Expand Toggle Button */}
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className="hidden sm:flex p-1.5 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title={isSidebarCollapsed ? 'Expand conversations sidebar' : 'Collapse sidebar'}
            >
              {isSidebarCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 text-orange-500" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>

            {/* Redesigned IRCTC AGENT Header Avatar */}
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 flex items-center justify-center text-white shadow-sm ring-1 ring-orange-500/30 shrink-0">
              <TrainFront className="w-4 h-4" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-bold text-zinc-950 dark:text-zinc-100 truncate">
                  {activeSession?.title || 'IRCTC AGENT'}
                </h2>
                <span className="hidden md:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live IRCTC Portal
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                Direct seats • Same-train split berths • Tatkal quotas • Live charting
              </p>
            </div>
          </div>

          {/* Header Right: Real-time Live Indian Standard Time (IST) Clock & Quick Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Live IST Digital Clock */}
            {currentTimeIST && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100/90 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 font-mono text-[11px] text-zinc-700 dark:text-zinc-300 shadow-2xs"
                title="Current Indian Standard Time (IST) in real-time"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="font-semibold tracking-tight tabular-nums">{currentTimeIST}</span>
                <span className="text-zinc-400 text-[10px]">IST</span>
              </div>
            )}

            {onSwitchToOptimizer && (
              <button
                type="button"
                onClick={() => onSwitchToOptimizer()}
                className="hidden lg:flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                title="Switch to Direct Optimizer matrix"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>Optimizer</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCreateNewSession}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Start New Chat Session"
            >
              <Plus className="w-3.5 h-3.5 text-orange-500" />
              <span>New Chat</span>
            </button>

            <button
              type="button"
              onClick={handleClearCurrentChat}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Clear Current Chat"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Messages Thread Canvas */}
        <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800">
          <div className="max-w-3xl lg:max-w-4xl mx-auto space-y-6 w-full">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              const hasSteps = msg.steps && msg.steps.length > 0;
              const hasRoutes = msg.routes && msg.routes.length > 0;
              const isStreamingThis = msg.status === 'streaming';

              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Redesigned Custom Avatars */}
                  {isUser ? (
                    <div
                      className="w-8 h-8 rounded-xl bg-gradient-to-br from-zinc-800 via-zinc-900 to-black dark:from-zinc-700 dark:to-zinc-900 flex items-center justify-center text-white shadow-sm ring-1 ring-white/10 shrink-0 mt-0.5"
                      title="Passenger Traveler"
                    >
                      <Compass className="w-4 h-4 text-zinc-300" />
                    </div>
                  ) : (
                    <div
                      className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 flex items-center justify-center text-white shadow-sm ring-1 ring-orange-500/30 shrink-0 mt-0.5"
                      title="IRCTC AGENT"
                    >
                      <TrainFront className="w-4 h-4" />
                    </div>
                  )}

                  {/* Message Bubble Container */}
                  <div
                    className={`space-y-2 max-w-[92%] sm:max-w-[85%] md:max-w-[80%] ${
                      isUser ? 'items-end' : 'items-start w-full'
                    }`}
                  >
                    {/* User Message */}
                    {isUser ? (
                      <div className="space-y-1">
                        <div className="px-4 py-2.5 rounded-2xl rounded-tr-xs bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-xs sm:text-sm font-medium shadow-xs leading-relaxed border border-zinc-800 dark:border-zinc-200">
                          {msg.content}
                        </div>
                        {/* User Timestamp in IST */}
                        <div className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 text-right pr-1 select-none">
                          {formatISTTime(msg.timestamp)}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 w-full">
                        {/* Live Engine Working Indicator (Only shown while actively streaming and no text yet) */}
                        {isStreamingThis && (!msg.content || msg.content.trim().length === 0) && (
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-xs font-mono animate-pulse w-fit">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>
                              {hasSteps && msg.steps && msg.steps[msg.steps.length - 1]?.label
                                ? msg.steps[msg.steps.length - 1].label
                                : 'Analyzing trains, split berths & seat matrix...'}
                            </span>
                          </div>
                        )}

                        {/* Main Assistant Text Response */}
                        {msg.content && (
                          <div className="group px-4 py-3.5 rounded-2xl rounded-tl-xs bg-zinc-50 dark:bg-zinc-900/90 border border-zinc-200/90 dark:border-zinc-800/90 hover:border-zinc-300 dark:hover:border-zinc-700/70 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 shadow-2xs transition-all duration-200">
                            <MarkdownRenderer content={msg.content} />
                          </div>
                        )}

                        {/* ChatGPT-style Advanced Action Bar & Tool Inspector Button BELOW the response */}
                        {msg.content && (
                          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
                            {/* Left: Action Buttons */}
                            <div className="flex items-center gap-1">
                              {/* Copy Message */}
                              <button
                                type="button"
                                onClick={() => handleCopyMessage(msg.content, msg.id)}
                                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                                title="Copy response to clipboard"
                              >
                                {copiedMsgId === msg.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>

                              {/* Regenerate */}
                              <button
                                type="button"
                                onClick={handleRegenerate}
                                disabled={isStreaming}
                                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer disabled:opacity-40"
                                title="Regenerate response"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>

                              {/* Thumbs Up */}
                              <button
                                type="button"
                                onClick={() => handleFeedback(msg.id, 'up')}
                                className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ${
                                  feedback[msg.id] === 'up'
                                    ? 'text-emerald-500 bg-emerald-500/10'
                                    : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                                }`}
                                title="Helpful response"
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                              </button>

                              {/* Thumbs Down */}
                              <button
                                type="button"
                                onClick={() => handleFeedback(msg.id, 'down')}
                                className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ${
                                  feedback[msg.id] === 'down'
                                    ? 'text-rose-500 bg-rose-500/10'
                                    : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
                                }`}
                                title="Not helpful"
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                              </button>

                              {/* Tools Used Inspector Pill Button (Click to open Popup Dialog) */}
                              {hasSteps && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedModalSteps(msg.steps || [])}
                                  className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 hover:bg-zinc-200/80 dark:bg-zinc-900/90 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer shadow-2xs group"
                                  title="Inspect tools query, parameters & responses"
                                >
                                  <Wrench className="w-3 h-3 text-orange-500 group-hover:rotate-45 transition-transform" />
                                  <span>
                                    {msg.steps?.length}{' '}
                                    {msg.steps?.length === 1 ? 'Action' : 'Actions'} Executed
                                  </span>
                                </button>
                              )}
                            </div>

                            {/* Right: Small Indian Standard Time (IST) Timing */}
                            <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400 dark:text-zinc-500 select-none">
                              <span>{formatISTTime(msg.timestamp)}</span>
                            </div>
                          </div>
                        )}

                        {/* Interactive Route Cards */}
                        {hasRoutes && (
                          <div className="space-y-3 pt-1">
                            <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
                              <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                Top Recommended Itineraries ({msg.routes?.length})
                              </span>
                              <span>Ranked by seat probability & fare</span>
                            </div>
                            {msg.routes?.map((route) => (
                              <ItineraryCard
                                key={route.id}
                                itinerary={route}
                                onOpenSchedule={(tNo, tName, b, a) =>
                                  onOpenSchedule?.(tNo, tName, b, a)
                                }
                                onOpenCoachLayout={(tNo, tName) =>
                                  onOpenCoachLayout?.(tNo, tName)
                                }
                                onOpenFareBreakdown={(f, tc, tNo, tName) =>
                                  onOpenFareBreakdown?.(f, tc, tNo, tName)
                                }
                                onOpenWatchdog={(tNo, tName, fStn, tStn, tc) =>
                                  onOpenWatchdog?.(tNo, tName, fStn, tStn, tc)
                                }
                                onOpenExportShare={(it) => onOpenExportShare?.(it)}
                              />
                            ))}
                          </div>
                        )}

                        {/* Suggestion Chips */}
                        {msg.suggestions && msg.suggestions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {msg.suggestions.map((sug, sIdx) => (
                              <button
                                key={`sug-${sIdx}`}
                                type="button"
                                onClick={() => sendMessage(sug)}
                                disabled={isStreaming}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-100 hover:bg-orange-50 dark:bg-zinc-800/80 dark:hover:bg-orange-950/30 text-zinc-700 hover:text-orange-600 dark:text-zinc-300 dark:hover:text-orange-400 border border-zinc-200 dark:border-zinc-700/60 hover:border-orange-300 dark:hover:border-orange-500/40 transition-all cursor-pointer shadow-2xs"
                              >
                                <span>{sug}</span>
                                <ArrowRight className="w-3 h-3 opacity-60" />
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
        </div>

        {/* Input Bar & Footer */}
        <div className="p-3 sm:p-4 border-t border-zinc-200 dark:border-zinc-800/90 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md shrink-0">
          <div className="max-w-3xl lg:max-w-4xl mx-auto space-y-2">
            <div className="group relative flex items-end gap-2 p-1.5 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300/80 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700/80 focus-within:border-orange-500 dark:focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 focus-within:shadow-[0_0_20px_rgba(249,115,22,0.12)] transition-all duration-200">
              <textarea
                ref={textareaRef}
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything: 'Trains from Jhansi to Bangalore on 28 Dec under 1500', or Tatkal rules..."
                rows={1}
                disabled={isStreaming}
                className="flex-1 max-h-36 resize-none bg-transparent px-3 py-2 text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden leading-relaxed"
              />

              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStopStreaming}
                  className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white shrink-0 transition-colors cursor-pointer"
                  title="Stop generating"
                >
                  <Square className="w-4 h-4 fill-white" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => sendMessage(inputPrompt)}
                  disabled={!inputPrompt.trim()}
                  className="p-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-40 disabled:cursor-not-allowed text-white shrink-0 shadow-xs transition-colors cursor-pointer"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1 font-mono">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-orange-500" />
                <span>IRCTC Agent with Live Web Intel & Route Discovery</span>
              </span>
              <span className="hidden sm:inline">Press Enter ↵ to send</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
