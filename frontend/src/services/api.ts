import type { RouteItinerary, StationItem, TrainScheduleResponse, MultiDateResponse } from '../types';

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

export function getStreamUrl(fromCode: string, toCode: string, date: string, quota = 'GN'): string {
  const params = new URLSearchParams({
    from: fromCode,
    to: toCode,
    date,
    quota,
  });
  return `${API_BASE_URL}/api/search/stream?${params.toString()}`;
}
