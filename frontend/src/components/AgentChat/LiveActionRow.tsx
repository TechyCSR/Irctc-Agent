import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Train,
  Clock,
  Calendar,
  Coins,
  ShieldAlert,
  Globe,
  Sparkles,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { AgentStep } from '../../types';

interface LiveActionRowProps {
  steps: AgentStep[];
  isStreaming?: boolean;
  hasContent?: boolean;
}

function getToolMeta(step: AgentStep) {
  const toolName = (step.toolName || '').toLowerCase();
  const label = (step.label || '').toLowerCase();

  if (toolName.includes('web_search') || label.includes('web search') || label.includes('guidelines') || label.includes('intel')) {
    return {
      title: 'Web & Rail Intel',
      subtitle: 'Official Circulars & News',
      icon: Globe,
      accent: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
      badge: 'INTEL',
    };
  }
  if (toolName.includes('resolve') || label.includes('resolving') || label.includes('resolved')) {
    return {
      title: 'Station Resolver',
      subtitle: 'City to Station Codes',
      icon: MapPin,
      accent: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      badge: 'STATIONS',
    };
  }
  if (toolName.includes('schedule') || label.includes('stops') || label.includes('timetable')) {
    return {
      title: 'Train Timetable',
      subtitle: 'Live Halts & Platform',
      icon: Clock,
      accent: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
      badge: 'TIMETABLE',
    };
  }
  if (toolName.includes('multi_date') || label.includes('5-day') || label.includes('multi-date')) {
    return {
      title: 'Multi-Date Scanner',
      subtitle: 'Seat Availability Window',
      icon: Calendar,
      accent: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
      badge: 'CALENDAR',
    };
  }
  if (toolName.includes('fare') || label.includes('breakdown')) {
    return {
      title: 'Fare Engine',
      subtitle: 'Taxes & Surcharge Slabs',
      icon: Coins,
      accent: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      badge: 'FARE',
    };
  }
  if (toolName.includes('chart') || label.includes('charting')) {
    return {
      title: 'Charting Timeline',
      subtitle: 'Vacant Berth Allocation',
      icon: ShieldAlert,
      accent: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
      badge: 'CHARTING',
    };
  }
  if (toolName.includes('search_trains') || label.includes('searching') || label.includes('evaluated') || label.includes('routes')) {
    return {
      title: 'Route Pathfinder',
      subtitle: 'Direct, Transfers & Splits',
      icon: Train,
      accent: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
      badge: 'PATHFINDER',
    };
  }

  return {
    title: 'Reasoning Engine',
    subtitle: 'Synthesizing Query Intent',
    icon: Sparkles,
    accent: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20',
    badge: 'AGENT',
  };
}

export const LiveActionRow: React.FC<LiveActionRowProps> = ({
  steps,
  isStreaming = false,
  hasContent = false,
}) => {
  // Collapse automatically when content starts or streaming finishes
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => !isStreaming || hasContent);

  useEffect(() => {
    if (hasContent || !isStreaming) {
      setIsCollapsed(true);
    } else {
      setIsCollapsed(false);
    }
  }, [hasContent, isStreaming]);

  if (!steps || steps.length === 0) return null;

  // Extract unique distinct tool titles for summary
  const toolTitles = Array.from(
    new Set(steps.map((s) => getToolMeta(s).title))
  ).slice(0, 3);

  // If collapsed, display a sleek summary pill
  if (isCollapsed) {
    return (
      <div className="my-2">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="group inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 hover:bg-zinc-200/60 dark:bg-zinc-900/80 dark:hover:bg-zinc-800/80 transition-all cursor-pointer text-left shadow-2xs"
          title="Click to view tool execution pipeline"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            {isStreaming && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isStreaming ? 'bg-orange-500' : 'bg-emerald-500'
              }`}
            />
          </span>

          <span className="text-[11px] font-mono font-medium text-zinc-700 dark:text-zinc-300">
            ⚡ {steps.length} {steps.length === 1 ? 'Action' : 'Actions'} Executed
          </span>

          {toolTitles.length > 0 && (
            <span className="hidden sm:inline-block text-[10px] text-zinc-400 dark:text-zinc-500 truncate max-w-xs">
              ({toolTitles.join(' • ')})
            </span>
          )}

          <ChevronDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-200 transition-transform" />
        </button>
      </div>
    );
  }

  return (
    <div className="my-2.5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800/80 bg-zinc-50/90 dark:bg-zinc-900/60 p-3 sm:p-3.5 shadow-2xs backdrop-blur-xs transition-all">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-zinc-200/70 dark:border-zinc-800/70">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            {isStreaming && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isStreaming ? 'bg-orange-500' : 'bg-emerald-500'
              }`}
            />
          </span>
          <span className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-700 dark:text-zinc-300">
            {isStreaming ? 'Live Railway Agent Execution' : 'Agent Action Pipeline'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-zinc-400">
            {steps.length} {steps.length === 1 ? 'Action' : 'Actions'}
          </span>
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Collapse tool actions"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Action Cards Row */}
      <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
        {steps.map((step, idx) => {
          const meta = getToolMeta(step);
          const Icon = meta.icon;
          const isLast = idx === steps.length - 1;
          const isActive = isStreaming && isLast;
          const isError = step.type === 'error';

          return (
            <div
              key={step.id || `step-${idx}`}
              className={`flex-none w-56 sm:w-64 flex flex-col justify-between p-2.5 rounded-xl border transition-all ${
                isActive
                  ? 'bg-orange-500/5 dark:bg-orange-500/10 border-orange-500/40 shadow-xs ring-1 ring-orange-500/20'
                  : isError
                  ? 'bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/40'
                  : 'bg-white dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/60 shadow-2xs'
              }`}
            >
              {/* Card Top: Icon, Tool Title & Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${meta.accent}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                      {meta.title}
                    </p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                      {meta.subtitle}
                    </p>
                  </div>
                </div>

                {/* Status indicator */}
                <div className="shrink-0">
                  {isActive ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-orange-600 dark:text-orange-400 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded-full">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Live
                    </span>
                  ) : isError ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-rose-500">
                      <AlertTriangle className="w-3 h-3" />
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-emerald-500">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </div>

              {/* Card Body: Explanation / Need */}
              <div className="mt-2 pt-2 border-t border-zinc-100 dark:border-zinc-700/50">
                <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300 line-clamp-2">
                  {step.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
