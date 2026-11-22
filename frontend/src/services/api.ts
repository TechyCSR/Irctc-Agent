import type {
  RouteItinerary,
  StationItem,
  TrainScheduleResponse,
  MultiDateResponse,
  QuotaItem,
  TrainCategoryItem,
  FareBreakdownItem,
  ChartingStatusResponse,
  WatchdogAlertItem,
  AgentConfig,
  AgentProviderOption,
  ChatMessage,
  AgentStep,
} from '../types';

export const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export async function searchStations(query: string): Promise<StationItem[]> {
  if (!query || query.trim().length < 1) return [];
  const res = await fetch(`${API_BASE_URL}/api/stations/search?q=${encodeURIComponent(query.trim())}`);
  if (!res.ok) throw new Error('Failed to fetch stations');
  return res.json();
}

export async function getPopularStations(): Promise<StationItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/stations/popular`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export interface SearchResponse {
  status: string;
  origin: string;
  destination: string;
  date: string;
  total_evaluated: number;
  total_confirmed: number;
  lowest_fare: number;
  routes: RouteItinerary[];
}

export async function searchRoutesREST(
  fromCode: string,
  toCode: string,
  date: string,
  quota = 'GN',
  preferredClass?: string
): Promise<SearchResponse> {
  const params = new URLSearchParams({
    from: fromCode,
    to: toCode,
    date,
    quota,
  });
  if (preferredClass) {
    params.set('class', preferredClass);
  }

  const res = await fetch(`${API_BASE_URL}/api/search?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Search request failed' }));
    throw new Error(err.message || 'Search failed');
  }
  return res.json();
}

export async function getTrainSchedule(trainNo: string, date?: string): Promise<TrainScheduleResponse> {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  const qs = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE_URL}/api/trains/${encodeURIComponent(trainNo)}/schedule${qs}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Schedule lookup failed' }));
    throw new Error(err.error || 'Failed to fetch schedule');
  }
  return res.json();
}

export async function getMultiDateAvailability(
  fromCode: string,
  toCode: string,
  startDate: string,
  days = 5,
  quota = 'GN'
): Promise<MultiDateResponse> {
  const params = new URLSearchParams({
    from: fromCode,
    to: toCode,
    start_date: startDate,
    days: days.toString(),
    quota,
  });
  const res = await fetch(`${API_BASE_URL}/api/availability/multi-date?${params.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to fetch multi-date availability');
  }
  return res.json();
}

export async function getQuotas(): Promise<QuotaItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/quotas`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.quotas || [];
  } catch {
    return [];
  }
}

export async function getTrainCategories(): Promise<TrainCategoryItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/trains/categories`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.categories || [];
  } catch {
    return [];
  }
}

export async function getFareBreakdown(fare: number, travelClass: string): Promise<FareBreakdownItem> {
  const params = new URLSearchParams({
    fare: fare.toString(),
    class: travelClass,
  });
  const res = await fetch(`${API_BASE_URL}/api/fares/breakdown?${params.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to fetch fare breakdown');
  }
  return res.json();
}

export async function getChartingStatus(depTime: string, date: string): Promise<ChartingStatusResponse> {
  const params = new URLSearchParams({
    dep_time: depTime,
    date,
  });
  const res = await fetch(`${API_BASE_URL}/api/charting/status?${params.toString()}`);
  if (!res.ok) {
    throw new Error('Failed to fetch charting status');
  }
  return res.json();
}

export async function subscribeWatchdog(payload: {
  train_no: string;
  doj: string;
  from_stn: string;
  to_stn: string;
  travel_class: string;
  quota: string;
  target_status?: string;
  notify_channel?: string;
  contact?: string;
}): Promise<WatchdogAlertItem> {
  const res = await fetch(`${API_BASE_URL}/api/watchdog/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to subscribe watchdog alert');
  return res.json();
}

export async function listWatchdogs(): Promise<WatchdogAlertItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/watchdog/list`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.alerts || [];
  } catch {
    return [];
  }
}

export async function deleteWatchdog(alertId: string): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/api/watchdog/${encodeURIComponent(alertId)}`, {
    method: 'DELETE',
  });
  return res.ok;
}

export function getStreamUrl(fromCode: string, toCode: string, date: string, quota = 'GN'): string {
  const params = new URLSearchParams({
    from: fromCode,
    to: toCode,
    date,
    quota,
  });
  return `${API_BASE_URL}/api/search/stream?${params.toString()}`;
}

// ==========================================
// AGENTIC AI CLIENT HELPERS
// ==========================================

const AGENT_CONFIG_KEY = 'irctc_copilot_config_v1';

export function getStoredAgentConfig(): AgentConfig {
  try {
    const raw = localStorage.getItem(AGENT_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.provider) {
        // Automatically default to Ollama (gemma4:31b) if previously auto without custom key
        if (parsed.provider === 'auto' && !parsed.apiKey) {
          return {
            provider: 'ollama',
            apiKey: '',
            model: 'gemma4:31b',
            endpoint: parsed.endpoint || 'http://localhost:11434/v1',
          };
        }
        return parsed;
      }
    }
  } catch {}
  return {
    provider: 'ollama',
    apiKey: '',
    model: 'gemma4:31b',
    endpoint: 'http://localhost:11434/v1',
  };
}

export function saveStoredAgentConfig(cfg: AgentConfig): void {
  try {
    localStorage.setItem(AGENT_CONFIG_KEY, JSON.stringify(cfg));
  } catch {}
}

export async function fetchAgentProviders(): Promise<AgentProviderOption[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/agent/models`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.providers || [];
  } catch {
    return [];
  }
}

export interface StreamChatCallbacks {
  onStep: (step: AgentStep) => void;
  onDelta: (chunk: string) => void;
  onComplete: (data: {
    text: string;
    steps: AgentStep[];
    routes: RouteItinerary[];
    suggestions: string[];
  }) => void;
  onError: (err: Error) => void;
}

export async function streamAgentChat(
  messages: ChatMessage[],
  config: AgentConfig,
  callbacks: StreamChatCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const payloadMessages = messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  try {
    const res = await fetch(`${API_BASE_URL}/api/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: payloadMessages,
        config: {
          provider: config.provider,
          apiKey: config.apiKey || undefined,
          model: config.model || undefined,
          endpoint: config.endpoint || undefined,
        },
      }),
      signal,
    });

    if (!res.ok) {
      throw new Error(`Agent API responded with ${res.status}: ${res.statusText}`);
    }

    if (!res.body) {
      throw new Error('No response body from Agent API');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const jsonStr = trimmed.slice(6);
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'step') {
              callbacks.onStep(event.step);
            } else if (event.type === 'delta') {
              callbacks.onDelta(event.content);
            } else if (event.type === 'complete') {
              callbacks.onComplete({
                text: event.text || '',
                steps: event.steps || [],
                routes: event.routes || [],
                suggestions: event.suggestions || [],
              });
            } else if (event.type === 'error') {
              callbacks.onError(new Error(event.message || 'Unknown streaming error'));
            }
          } catch (e) {
            console.warn('Failed to parse SSE event:', jsonStr, e);
          }
        }
      }
    }
  } catch (err: any) {
    if (signal?.aborted) return;
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }
}
