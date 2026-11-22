import React, { useState } from 'react';
import {
  X,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrainFront,
  MapPin,
  Calendar,
  Globe,
  Coins,
  ShieldAlert,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Terminal,
} from 'lucide-react';
import type { AgentStep } from '../../types';

interface ToolExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  steps: AgentStep[];
}

function getToolDisplay(toolName?: string, label?: string) {
  const name = (toolName || '').toLowerCase();
  const lbl = (label || '').toLowerCase();

  if (name.includes('search_trains') || lbl.includes('routes') || lbl.includes('train')) {
    return {
      title: 'Train Route Pathfinder',
      badge: 'search_trains',
      color: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
      icon: TrainFront,
    };
  }
  if (name.includes('resolve') || lbl.includes('station')) {
    return {
      title: 'Station Code Resolver',
      badge: 'resolve_station',
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      icon: MapPin,
    };
  }
  if (name.includes('schedule') || lbl.includes('stops') || lbl.includes('timetable')) {
    return {
      title: 'Timetable & Platform Halts',
      badge: 'get_train_schedule',
      color: 'text-purple-500 bg-purple-500/10 border-purple-500/20',
      icon: Clock,
    };
  }
  if (name.includes('chart') || lbl.includes('charting')) {
    return {
      title: 'Charting Vacancy Timeline',
      badge: 'get_charting_status',
      color: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
      icon: ShieldAlert,
    };
  }
  if (name.includes('web_search') || lbl.includes('intel') || lbl.includes('rules')) {
    return {
      title: 'Railway Rules & Live Intel',
      badge: 'web_search_rail_intel',
      color: 'text-sky-500 bg-sky-500/10 border-sky-500/20',
      icon: Globe,
    };
  }
  if (name.includes('fare')) {
    return {
      title: 'Fare Engine & Surcharges',
      badge: 'calculate_fare',
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      icon: Coins,
    };
  }
  if (name.includes('multi_date')) {
    return {
      title: 'Multi-Date Seat Scanner',
      badge: 'get_multidate_availability',
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
      icon: Calendar,
    };
  }

  return {
    title: 'Reasoning Step',
    badge: toolName || 'agent_step',
    color: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20',
    icon: Terminal,
  };
}

export const ToolExecutionModal: React.FC<ToolExecutionModalProps> = ({
  isOpen,
  onClose,
  steps,
}) => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<Record<number, boolean>>({});

  if (!isOpen) return null;

  // Group steps by tool_call and its corresponding tool_result
  interface PairedToolAction {
    id: string;
    toolName: string;
    callLabel: string;
    resultLabel?: string;
    input?: any;
    output?: any;
    isError: boolean;
  }

  const pairedActions: PairedToolAction[] = [];
  let pendingTool: {
    toolName: string;
    callLabel: string;
    input?: any;
    output?: any;
    resultLabel?: string;
    isError: boolean;
  } | null = null;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.type === 'tool_call') {
      if (pendingTool) {
        pairedActions.push({
          id: `tool-${pairedActions.length}`,
          toolName: pendingTool.toolName,
          callLabel: pendingTool.callLabel,
          resultLabel: pendingTool.resultLabel,
          input: pendingTool.input,
          output: pendingTool.output,
          isError: pendingTool.isError,
        });
      }
      pendingTool = {
        toolName: step.toolName || 'tool',
        callLabel: step.label,
        input: step.input,
        isError: false,
      };
    } else if (step.type === 'tool_result') {
      if (pendingTool) {
        pairedActions.push({
          id: `tool-${pairedActions.length}`,
          toolName: pendingTool.toolName,
          callLabel: pendingTool.callLabel,
          resultLabel: step.label,
          input: pendingTool.input,
          output: step.output,
          isError: false,
        });
        pendingTool = null;
      } else {
        pairedActions.push({
          id: `res-${i}`,
          toolName: step.toolName || 'action',
          callLabel: step.label,
          resultLabel: step.label,
          output: step.output,
          isError: false,
        });
      }
    } else if (step.type === 'error') {
      if (pendingTool) {
        pairedActions.push({
          id: `tool-${pairedActions.length}`,
          toolName: pendingTool.toolName,
          callLabel: pendingTool.callLabel,
          resultLabel: step.label,
          input: pendingTool.input,
          isError: true,
        });
        pendingTool = null;
      } else {
        pairedActions.push({
          id: `err-${i}`,
          toolName: 'error',
          callLabel: step.label,
          isError: true,
        });
      }
    }
  }

  if (pendingTool !== null) {
    pairedActions.push({
      id: `tool-${pairedActions.length}`,
      toolName: pendingTool.toolName,
      callLabel: pendingTool.callLabel,
      resultLabel: pendingTool.resultLabel || 'Action in progress...',
      input: pendingTool.input,
      isError: false,
    });
  }

  const handleCopyJson = (content: any, index: number) => {
    navigator.clipboard.writeText(
      typeof content === 'string' ? content : JSON.stringify(content, null, 2)
    );
    setCopiedIdx(index);
    setTimeout(() => setCopiedIdx(null), 1800);
  };

  const toggleExpand = (idx: number) => {
    setExpandedDetails((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-100 flex items-center gap-2">
                Agent Tool Execution Pipeline
                <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                  {pairedActions.length} {pairedActions.length === 1 ? 'Action' : 'Actions'}
                </span>
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Detailed queries, resolved parameters, and tool response payloads
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
          {pairedActions.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 text-xs">
              No tool executions recorded for this message.
            </div>
          ) : (
            pairedActions.map((action, idx) => {
              const display = getToolDisplay(action.toolName, action.callLabel);
              const Icon = display.icon;
              const hasInput = action.input && Object.keys(action.input).length > 0;
              const isExpanded = Boolean(expandedDetails[idx]);

              return (
                <div
                  key={action.id}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 p-3.5 space-y-3 transition-all hover:border-zinc-300 dark:hover:border-zinc-700"
                >
                  {/* Tool Title Bar */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${display.color}`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                            {display.title}
                          </h4>
                          <code className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                            {display.badge}
                          </code>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {action.isError ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                          <AlertTriangle className="w-3 h-3" /> Error
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Success
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Query / Input Parameters */}
                  {hasInput && (
                    <div className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-mono font-semibold text-zinc-500">
                        <span>INPUT PARAMETERS</span>
                        <button
                          type="button"
                          onClick={() => handleCopyJson(action.input, idx)}
                          className="flex items-center gap-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                          title="Copy input parameters"
                        >
                          {copiedIdx === idx ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-500" />
                              <span className="text-emerald-500">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-xs">
                        {Object.entries(action.input).map(([key, val]) => (
                          <div
                            key={key}
                            className="p-1.5 rounded-md bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-700/50"
                          >
                            <span className="text-[10px] font-mono text-zinc-400 block uppercase">
                              {key}
                            </span>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate block">
                              {String(val ?? '-')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tool Result / Output Summary */}
                  <div className="rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-mono font-semibold text-zinc-500">
                      <span>TOOL OUTPUT / RESOLUTION</span>
                      {action.output && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(idx)}
                          className="flex items-center gap-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                        >
                          <span>{isExpanded ? 'Hide Raw' : 'View Raw'}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
                      {action.resultLabel || action.callLabel}
                    </p>

                    {isExpanded && action.output && (
                      <pre className="mt-2 p-2.5 rounded bg-zinc-100 dark:bg-zinc-950 font-mono text-[11px] text-zinc-800 dark:text-zinc-200 overflow-x-auto max-h-40 scrollbar-thin">
                        {typeof action.output === 'string'
                          ? action.output
                          : JSON.stringify(action.output, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/80 flex items-center justify-between">
          <span className="text-[11px] font-mono text-zinc-400">
            Powered by IRCTC Agentic Pipeline
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
