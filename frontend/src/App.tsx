import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Train,
  ArrowRightLeft,
  Search,
  AlertCircle,
  ArrowUpDown,
  History,
  Info,
  ExternalLink,
  Compass,
  X,
  Share2,
  SlidersHorizontal
} from 'lucide-react';
import { StationInput } from './components/StationInput';
import { ItineraryCard } from './components/ItineraryCard';
import { AmbientRouteCanvas } from './components/AmbientRouteCanvas';
import { BootLoader } from './components/BootLoader';
import { TrainScheduleModal } from './components/TrainScheduleModal';
import { DateStripSelector } from './components/DateStripSelector';
import { ToastProvider, useToast } from './components/Toast';
import { searchRoutesREST, searchStations } from './services/api';
import type { RouteItinerary, StationItem } from './types';

interface RecentSearchItem {
  from: StationItem;
  to: StationItem;
  date: string;
}

const POPULAR_PAIRS = [
  { from: { code: 'NDLS', name: 'New Delhi', city: 'Delhi', state: 'Delhi' }, to: { code: 'CSMT', name: 'Mumbai CSMT', city: 'Mumbai', state: 'Maharashtra' } },
  { from: { code: 'JU', name: 'Jodhpur Jn', city: 'Jodhpur', state: 'Rajasthan' }, to: { code: 'SBC', name: 'KSR Bengaluru', city: 'Bengaluru', state: 'Karnataka' } },
  { from: { code: 'MAS', name: 'Chennai Central', city: 'Chennai', state: 'Tamil Nadu' }, to: { code: 'SBC', name: 'KSR Bengaluru', city: 'Bengaluru', state: 'Karnataka' } },
  { from: { code: 'HWH', name: 'Howrah Jn', city: 'Kolkata', state: 'West Bengal' }, to: { code: 'NDLS', name: 'New Delhi', city: 'Delhi', state: 'Delhi' } },
  { from: { code: 'ADI', name: 'Ahmedabad Jn', city: 'Ahmedabad', state: 'Gujarat' }, to: { code: 'PUNE', name: 'Pune Jn', city: 'Pune', state: 'Maharashtra' } },
];

function getTomorrowDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

function formatDateToDDMMYYYY(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return isoDate;
}

function formatDDMMYYYYToISO(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

const MainApp: React.FC = () => {
  const { showToast } = useToast();

  // Boot sequence state
  const [isBooting, setIsBooting] = useState<boolean>(() => {
    return !sessionStorage.getItem('irctc_agent_booted');
  });

  // Search parameters
  const [fromStation, setFromStation] = useState<StationItem | null>(null);
  const [toStation, setToStation] = useState<StationItem | null>(null);
  const [journeyDate, setJourneyDate] = useState<string>(getTomorrowDateStr());
  const [quota, setQuota] = useState('GN');

  // Search state & results
  const [routes, setRoutes] = useState<RouteItinerary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchStatusText, setSearchStatusText] = useState('');
  const [totalEvaluated, setTotalEvaluated] = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [lowestFare, setLowestFare] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  // Filters & sorting
  const [activeTab, setActiveTab] = useState<'ALL' | 'CONFIRMED' | 'DIRECT'>('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [hubFilter, setHubFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'SCORE' | 'DURATION' | 'FARE' | 'DEPARTURE'>('SCORE');
  const [textFilter, setTextFilter] = useState('');

  // Advanced Filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sameStationOnly, setSameStationOnly] = useState(false);
  const [minLayoverMinutes, setMinLayoverMinutes] = useState(0);
  const [departureTimeWindow, setDepartureTimeWindow] = useState<'ALL' | 'MORNING' | 'AFTERNOON' | 'NIGHT'>('ALL');

  // Schedule modal state
  const [activeScheduleTrain, setActiveScheduleTrain] = useState<{
    no: string;
    name: string;
    boarding: string;
    alighting: string;
  } | null>(null);

  // UI state
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);

  const handleBootComplete = () => {
    sessionStorage.setItem('irctc_agent_booted', 'true');
    setIsBooting(false);
  };

  // URL Query Sync on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromCode = params.get('from');
    const toCode = params.get('to');
    const dateParam = params.get('date');
    const quotaParam = params.get('quota');

    if (quotaParam) setQuota(quotaParam);
    if (dateParam) {
      if (dateParam.includes('-') && dateParam.split('-')[0].length === 2) {
        setJourneyDate(formatDDMMYYYYToISO(dateParam));
      } else {
        setJourneyDate(dateParam);
      }
    }

    if (fromCode && toCode) {
      Promise.all([searchStations(fromCode), searchStations(toCode)])
        .then(([fromMatches, toMatches]) => {
          if (fromMatches && fromMatches.length > 0) setFromStation(fromMatches[0]);
          if (toMatches && toMatches.length > 0) setToStation(toMatches[0]);
        })
        .catch(console.error);
    }
  }, []);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('irctc_agent_recent_searches');
      if (stored) {
        setRecentSearches(JSON.parse(stored).slice(0, 5));
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Save recent search
  const saveRecentSearch = (from: StationItem, to: StationItem, date: string) => {
    try {
      const updated = [
        { from, to, date },
        ...recentSearches.filter(
          (s) => !(s.from.code === from.code && s.to.code === to.code)
        ),
      ].slice(0, 5);
      setRecentSearches(updated);
      localStorage.setItem('irctc_agent_recent_searches', JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  };

  // Swap Stations
  const handleSwap = () => {
    const temp = fromStation;
    setFromStation(toStation);
    setToStation(temp);
  };

  // Execute Search
  const executeSearch = useCallback(
    async (src: StationItem | null, dst: StationItem | null, date: string, qCode: string) => {
      if (!src || !dst) {
        showToast('Please select both Origin and Destination stations', 'error');
        return;
      }
      if (src.code === dst.code) {
        showToast('Origin and Destination stations cannot be identical', 'error');
        return;
      }

      setIsSearching(true);
      setSearchStatusText('Scanning 8,566 stations network & querying live IRCTC availability...');
      setRoutes([]);
      setHasSearched(true);

      const formattedDate = formatDateToDDMMYYYY(date);

      // Update URL search query
      const urlParams = new URLSearchParams({
        from: src.code,
        to: dst.code,
        date: formattedDate,
        quota: qCode,
      });
      window.history.replaceState(null, '', `?${urlParams.toString()}`);

      try {
        saveRecentSearch(src, dst, date);
        setSearchStatusText(`Evaluating direct lines & intermediate corridor hubs...`);

        const resp = await searchRoutesREST(
          src.code,
          dst.code,
          formattedDate,
          qCode,
          classFilter !== 'ALL' ? classFilter : undefined
        );

        if (resp.status === 'success') {
          setRoutes(resp.routes || []);
          setTotalEvaluated(resp.total_evaluated || 0);
          setConfirmedCount(resp.total_confirmed || 0);
          setLowestFare(resp.lowest_fare || 0);

          if ((resp.routes || []).length > 0) {
            showToast(
              `Found ${resp.routes.length} options (${resp.total_confirmed} with confirmed seats)`,
              'success'
            );
          } else {
            showToast('No available trains found for this date. Try an adjacent date.', 'info');
          }
        }
      } catch (err: any) {
        console.error('Search failure:', err);
        showToast(err.message || 'Search failed. Please try again.', 'error');
      } finally {
        setIsSearching(false);
        setSearchStatusText('');
      }
    },
    [classFilter, showToast]
  );

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    executeSearch(fromStation, toStation, journeyDate, quota);
  };

  // Date strip selection handler
  const handleDateStripSelect = (isoDate: string) => {
    setJourneyDate(isoDate);
    if (fromStation && toStation) {
      executeSearch(fromStation, toStation, isoDate, quota);
    }
  };

  // Share search link
  const handleShareLink = () => {
    if (!fromStation || !toStation) {
      showToast('Select stations before sharing', 'info');
      return;
    }
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    showToast('Direct search link copied to clipboard', 'success');
  };

  // Quick preset pair selection
  const selectPopularPair = (pair: { from: StationItem; to: StationItem }) => {
    setFromStation(pair.from);
    setToStation(pair.to);
  };

  // Available intermediate hubs for filter dropdown
  const availableHubs = useMemo(() => {
    const hubs = new Set<string>();
    routes.forEach((r) => {
      if (r.type === '1_TRANSFER' && r.hub) {
        hubs.add(r.hub);
      }
    });
    return Array.from(hubs);
  }, [routes]);

  // Filtered & Sorted Routes
  const displayedRoutes = useMemo(() => {
    let result = routes.filter((it) => {
      // Type/Status Tab Filter
      if (activeTab === 'CONFIRMED' && it.booking_confidence !== 'CONFIRMED') return false;
      if (activeTab === 'DIRECT' && it.type !== 'DIRECT') return false;

      // Hub Filter
      if (hubFilter !== 'ALL' && it.hub !== hubFilter) return false;

      // Same station transfer filter
      if (sameStationOnly && it.inter_station_transfer) return false;

      // Minimum layover filter
      if (minLayoverMinutes > 0 && it.type === '1_TRANSFER' && it.layover_minutes < minLayoverMinutes) {
        return false;
      }

      // Class Filter
      if (classFilter !== 'ALL') {
        const hasClass = it.legs.every((l) => Object.keys(l.seats).includes(classFilter));
        if (!hasClass) return false;
      }

      // Departure time window filter
      if (departureTimeWindow !== 'ALL' && it.legs.length > 0) {
        const depStr = it.legs[0].dep_time_only || it.legs[0].departure.split(' ').pop() || '12:00';
        const hour = parseInt(depStr.split(':')[0], 10);
        if (departureTimeWindow === 'MORNING' && (hour < 4 || hour >= 12)) return false;
        if (departureTimeWindow === 'AFTERNOON' && (hour < 12 || hour >= 17)) return false;
        if (departureTimeWindow === 'NIGHT' && (hour < 17 && hour >= 4)) return false;
      }

      // Text Search Filter (train number or train name)
      if (textFilter.trim()) {
        const q = textFilter.toLowerCase().trim();
        const matches = it.legs.some(
          (l) => l.train_no.toLowerCase().includes(q) || l.train_name.toLowerCase().includes(q)
        );
        if (!matches) return false;
      }

      return true;
    });

    // Sort order
    result.sort((a, b) => {
      if (sortBy === 'SCORE') {
        return a.rank - b.rank;
      }
      if (sortBy === 'DURATION') {
        return a.total_duration_minutes - b.total_duration_minutes;
      }
      if (sortBy === 'FARE') {
        const fareA = a.best_fare || 999999;
        const fareB = b.best_fare || 999999;
        return fareA - fareB;
      }
      if (sortBy === 'DEPARTURE') {
        const depA = a.legs[0]?.departure || '99:99';
        const depB = b.legs[0]?.departure || '99:99';
        return depA.localeCompare(depB);
      }
      return 0;
    });

    return result;
  }, [
    routes,
    activeTab,
    hubFilter,
    sameStationOnly,
    minLayoverMinutes,
    classFilter,
    departureTimeWindow,
    textFilter,
    sortBy,
  ]);

  return (
    <>
      {isBooting && <BootLoader onComplete={handleBootComplete} />}

      <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col font-sans selection:bg-neutral-900 selection:text-white">
        {/* Top Ambient Visualizer Header */}
        <header className="relative border-b border-neutral-200 bg-white overflow-hidden">
          {/* Three.js Ambient Particle Grid Canvas */}
          <AmbientRouteCanvas
            isSearching={isSearching}
            className="absolute inset-0 w-full h-full opacity-40"
          />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-7">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-lg bg-neutral-950 text-white font-mono text-sm font-bold flex items-center justify-center shadow-xs">
                    <Train className="w-4 h-4" />
                  </span>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight uppercase font-mono text-neutral-950">
                      IRCTC AGENT
                    </h1>
                    <p className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
                      Confirmed Ticket Discovery & Smart 1-Transfer Pathfinder
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-neutral-200 bg-neutral-100 font-mono text-xs font-medium text-neutral-700">
                  <span className="w-2 h-2 rounded-full bg-neutral-900 animate-pulse" />
                  8,566 STATIONS INDEXED
                </span>

                {hasSearched && (
                  <button
                    type="button"
                    onClick={handleShareLink}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-neutral-300 hover:border-neutral-900 text-xs font-medium text-neutral-800 transition bg-white"
                  >
                    <Share2 className="w-3.5 h-3.5 text-neutral-600" />
                    <span>Share Route</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsHowItWorksOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-neutral-300 hover:border-neutral-900 text-xs font-medium text-neutral-800 transition bg-white"
                >
                  <Info className="w-3.5 h-3.5 text-neutral-600" />
                  <span>How It Works</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
          {/* Search Control Card */}
          <div className="bg-white border border-neutral-200 rounded-xl p-5 sm:p-6 shadow-xs">
            <form onSubmit={handleSearchSubmit} className="space-y-4">
              {/* Origin & Destination Inputs with Swap */}
              <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-end">
                <div className="md:col-span-5">
                  <StationInput
                    label="From Station"
                    value={fromStation}
                    onChange={setFromStation}
                    placeholder="Search any origin station or city..."
                  />
                </div>

                <div className="md:col-span-1 flex items-center justify-center pb-0.5">
                  <button
                    type="button"
                    onClick={handleSwap}
                    title="Swap Origin and Destination"
                    className="p-2.5 rounded-lg border border-neutral-200 hover:border-neutral-900 bg-neutral-50 hover:bg-neutral-100 text-neutral-700 transition active:scale-95"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                  </button>
                </div>

                <div className="md:col-span-5">
                  <StationInput
                    label="To Station"
                    value={toStation}
                    onChange={setToStation}
                    placeholder="Search any destination station or city..."
                  />
                </div>
              </div>

              {/* Date, Quota, Class, and Submit Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                {/* Journey Date */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
                    Journey Date
                  </label>
                  <input
                    type="date"
                    value={journeyDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setJourneyDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-950 focus:border-neutral-950 transition shadow-xs"
                  />
                </div>

                {/* Quota */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
                    Quota
                  </label>
                  <select
                    value={quota}
                    onChange={(e) => setQuota(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-950 focus:border-neutral-950 transition shadow-xs"
                  >
                    <option value="GN">General Quota (GN)</option>
                    <option value="TQ">Tatkal Quota (TQ)</option>
                    <option value="LD">Ladies Quota (LD)</option>
                    <option value="SS">Lower Berth / Senior (SS)</option>
                  </select>
                </div>

                {/* Preferred Class */}
                <div>
                  <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
                    Preferred Class
                  </label>
                  <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-neutral-200 rounded-lg text-sm font-semibold text-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-950 focus:border-neutral-950 transition shadow-xs"
                  >
                    <option value="ALL">All Classes</option>
                    <option value="3A">AC 3 Tier (3A)</option>
                    <option value="2A">AC 2 Tier (2A)</option>
                    <option value="1A">AC 1st Class (1A)</option>
                    <option value="3E">AC 3 Economy (3E)</option>
                    <option value="SL">Sleeper (SL)</option>
                    <option value="CC">AC Chair Car (CC)</option>
                    <option value="2S">Second Sitting (2S)</option>
                  </select>
                </div>

                {/* Search Submit Button */}
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="w-full py-2.5 px-4 rounded-lg bg-neutral-950 hover:bg-neutral-800 disabled:bg-neutral-400 text-white font-mono text-sm font-bold flex items-center justify-center gap-2 transition shadow-xs active:scale-[0.98]"
                  >
                    {isSearching ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>SEARCHING...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>FIND CONFIRMED SEATS</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Advanced Filter Toggle & Popular Presets Row */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-neutral-100">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-[10px] font-mono uppercase text-neutral-400 font-bold mr-1">
                    Popular Routes:
                  </span>
                  {POPULAR_PAIRS.map((pair) => (
                    <button
                      key={`${pair.from.code}-${pair.to.code}`}
                      type="button"
                      onClick={() => selectPopularPair(pair)}
                      className="px-2 py-0.5 rounded border border-neutral-200 hover:border-neutral-900 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 text-[11px] font-mono transition"
                    >
                      {pair.from.code} → {pair.to.code}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="inline-flex items-center gap-1 text-xs font-mono text-neutral-600 hover:text-neutral-950 self-start sm:self-auto font-medium transition"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>{showAdvancedFilters ? 'Hide Filters' : 'More Filters'}</span>
                </button>
              </div>

              {/* Collapsible Advanced Filters Drawer */}
              {showAdvancedFilters && (
                <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-slide-up">
                  {/* Same Station Transfer */}
                  <label className="flex items-center gap-2 cursor-pointer font-mono text-neutral-800">
                    <input
                      type="checkbox"
                      checked={sameStationOnly}
                      onChange={(e) => setSameStationOnly(e.target.checked)}
                      className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
                    />
                    <span>Same Station Only (No inter-station taxi)</span>
                  </label>

                  {/* Layover buffer */}
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-neutral-500 font-bold mb-1">
                      Min Layover Buffer
                    </label>
                    <select
                      value={minLayoverMinutes}
                      onChange={(e) => setMinLayoverMinutes(parseInt(e.target.value, 10))}
                      className="w-full px-2 py-1 bg-white border border-neutral-200 rounded font-mono text-xs text-neutral-800 focus:outline-none"
                    >
                      <option value={0}>Any Layover (1h+)</option>
                      <option value={120}>Min 2 Hours</option>
                      <option value={180}>Min 3 Hours</option>
                      <option value={240}>Min 4 Hours</option>
                    </select>
                  </div>

                  {/* Departure window */}
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-neutral-500 font-bold mb-1">
                      Departure Time
                    </label>
                    <select
                      value={departureTimeWindow}
                      onChange={(e) => setDepartureTimeWindow(e.target.value as any)}
                      className="w-full px-2 py-1 bg-white border border-neutral-200 rounded font-mono text-xs text-neutral-800 focus:outline-none"
                    >
                      <option value="ALL">All Times (24h)</option>
                      <option value="MORNING">Morning (04:00 - 12:00)</option>
                      <option value="AFTERNOON">Afternoon (12:00 - 17:00)</option>
                      <option value="NIGHT">Evening / Night (17:00 - 04:00)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="pt-1 flex flex-wrap items-center gap-1.5 text-xs border-t border-neutral-100">
                  <span className="text-[10px] font-mono uppercase text-neutral-400 font-bold mr-1 flex items-center gap-1">
                    <History className="w-3 h-3" /> Recent:
                  </span>
                  {recentSearches.map((rec) => (
                    <button
                      key={`${rec.from.code}-${rec.to.code}-${rec.date}`}
                      type="button"
                      onClick={() => {
                        setFromStation(rec.from);
                        setToStation(rec.to);
                        setJourneyDate(rec.date);
                      }}
                      className="px-2 py-0.5 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-[11px] font-mono transition flex items-center gap-1"
                    >
                      <span>{rec.from.code} → {rec.to.code}</span>
                      <span className="text-[10px] text-neutral-400">({rec.date})</span>
                    </button>
                  ))}
                </div>
              )}
            </form>
          </div>

          {/* Interactive 5-Day Availability Matrix Strip */}
          {fromStation && toStation && (
            <DateStripSelector
              fromCode={fromStation.code}
              toCode={toStation.code}
              selectedDate={journeyDate}
              onSelectDate={handleDateStripSelect}
              quota={quota}
            />
          )}

          {/* Real-time Search Progress Banner */}
          {isSearching && (
            <div className="bg-white border border-neutral-300 rounded-xl p-4 flex items-center gap-3.5 shadow-xs animate-pulse">
              <div className="w-5 h-5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-mono font-bold text-neutral-900">
                  {searchStatusText || 'Searching all railway corridors across India...'}
                </div>
                <div className="text-xs text-neutral-500 font-mono mt-0.5">
                  Analyzing direct trains, checking intermediate junction transfers, calculating layover safety
                </div>
              </div>
            </div>
          )}

          {/* Results Section */}
          {hasSearched && (
            <div className="space-y-4">
              {/* Results Header Summary Bar */}
              <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-neutral-400 block font-bold">
                      Journey Corridor
                    </span>
                    <span className="text-sm font-mono font-bold text-neutral-950">
                      {fromStation?.code} ({fromStation?.name}) → {toStation?.code} ({toStation?.name})
                    </span>
                  </div>
                  <div className="h-6 w-px bg-neutral-200 hidden sm:block" />
                  <div>
                    <span className="text-[10px] font-mono uppercase text-neutral-400 block font-bold">
                      Evaluated
                    </span>
                    <span className="text-sm font-mono font-bold text-neutral-900">
                      {totalEvaluated} routes
                    </span>
                  </div>
                  <div className="h-6 w-px bg-neutral-200 hidden sm:block" />
                  <div>
                    <span className="text-[10px] font-mono uppercase text-neutral-400 block font-bold">
                      Confirmed Options
                    </span>
                    <span className="text-sm font-mono font-bold text-neutral-950">
                      {confirmedCount} available
                    </span>
                  </div>
                  {lowestFare > 0 && (
                    <>
                      <div className="h-6 w-px bg-neutral-200 hidden sm:block" />
                      <div>
                        <span className="text-[10px] font-mono uppercase text-neutral-400 block font-bold">
                          Lowest Fare
                        </span>
                        <span className="text-sm font-mono font-bold text-neutral-950">
                          ₹{lowestFare}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Quick Tab Filters */}
                <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded-lg self-start md:self-auto">
                  <button
                    type="button"
                    onClick={() => setActiveTab('ALL')}
                    className={`px-3 py-1 rounded text-xs font-mono font-bold transition ${
                      activeTab === 'ALL'
                        ? 'bg-neutral-950 text-white shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    All ({routes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('CONFIRMED')}
                    className={`px-3 py-1 rounded text-xs font-mono font-bold transition ${
                      activeTab === 'CONFIRMED'
                        ? 'bg-neutral-950 text-white shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Confirmed ({confirmedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('DIRECT')}
                    className={`px-3 py-1 rounded text-xs font-mono font-bold transition ${
                      activeTab === 'DIRECT'
                        ? 'bg-neutral-950 text-white shadow-2xs'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    Direct Only
                  </button>
                </div>
              </div>

              {/* Filter & Sort Controls Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Intermediate Hub Filter */}
                  {availableHubs.length > 0 && (
                    <select
                      value={hubFilter}
                      onChange={(e) => setHubFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg font-mono text-neutral-800 text-xs focus:outline-none focus:border-neutral-900"
                    >
                      <option value="ALL">All Transfer Hubs ({availableHubs.length})</option>
                      {availableHubs.map((h) => (
                        <option key={h} value={h}>
                          Via {h}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Text Filter for Train # */}
                  <input
                    type="text"
                    placeholder="Filter train name / number..."
                    value={textFilter}
                    onChange={(e) => setTextFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg text-xs font-mono text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-900 w-52"
                  />
                </div>

                {/* Sort Dropdown */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="text-neutral-400 font-mono text-[11px] uppercase font-bold flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3" /> Sort:
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-2.5 py-1.5 bg-white border border-neutral-200 rounded-lg font-mono text-neutral-800 text-xs focus:outline-none focus:border-neutral-900"
                  >
                    <option value="SCORE">Recommended (Best Match)</option>
                    <option value="DURATION">Shortest Travel Time</option>
                    <option value="FARE">Lowest Combined Fare</option>
                    <option value="DEPARTURE">Earliest Departure</option>
                  </select>
                </div>
              </div>

              {/* Itinerary Cards List */}
              {displayedRoutes.length > 0 ? (
                <div className="space-y-4">
                  {displayedRoutes.map((itinerary) => (
                    <ItineraryCard
                      key={itinerary.id}
                      itinerary={itinerary}
                      onOpenSchedule={(no, name, boarding, alighting) =>
                        setActiveScheduleTrain({ no, name, boarding, alighting })
                      }
                    />
                  ))}
                </div>
              ) : !isSearching ? (
                <div className="bg-white border border-neutral-200 rounded-xl p-12 text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-neutral-400 mx-auto" />
                  <h3 className="text-base font-mono font-bold text-neutral-900">
                    No matching route options found
                  </h3>
                  <p className="text-xs text-neutral-500 max-w-md mx-auto">
                    Try switching filters (e.g. choose "All Classes" or reset the transfer hub filter),
                    or pick an adjacent travel date from the matrix above.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('ALL');
                      setHubFilter('ALL');
                      setClassFilter('ALL');
                      setTextFilter('');
                      setSameStationOnly(false);
                      setMinLayoverMinutes(0);
                      setDepartureTimeWindow('ALL');
                    }}
                    className="px-3.5 py-1.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-100 text-xs font-mono font-bold text-neutral-800 transition"
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                /* Loading Skeletons */
                <div className="space-y-4">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4 animate-pulse"
                    >
                      <div className="flex justify-between items-center">
                        <div className="h-6 w-32 bg-neutral-200 rounded" />
                        <div className="h-6 w-24 bg-neutral-200 rounded" />
                      </div>
                      <div className="h-20 bg-neutral-100 rounded-lg" />
                      <div className="h-10 bg-neutral-100 rounded-lg" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Initial Prompt State (before search) */}
          {!hasSearched && (
            <div className="bg-white border border-neutral-200 rounded-xl p-8 sm:p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-800">
                <Compass className="w-6 h-6 stroke-[1.5]" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-mono font-bold text-neutral-900 uppercase">
                  Find Confirmed Berths Anywhere in India
                </h2>
                <p className="text-xs text-neutral-500 max-w-lg mx-auto mt-1">
                  When direct trains are waitlisted (WL) or closed (REGRET), IRCTC AGENT searches 1-transfer
                  corridors with guaranteed layover safety and multi-date matrix to find confirmed berths.
                </p>
              </div>
              <div className="pt-2">
                <span className="text-[11px] font-mono text-neutral-400">
                  Select your origin & destination above, or pick one of the popular routes to begin.
                </span>
              </div>
            </div>
          )}
        </main>

        {/* Train Schedule Modal */}
        {activeScheduleTrain && (
          <TrainScheduleModal
            trainNo={activeScheduleTrain.no}
            trainName={activeScheduleTrain.name}
            boardingCode={activeScheduleTrain.boarding}
            alightingCode={activeScheduleTrain.alighting}
            onClose={() => setActiveScheduleTrain(null)}
          />
        )}

        {/* "How It Works" Modal */}
        {isHowItWorksOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/60 backdrop-blur-xs">
            <div className="bg-white border border-neutral-300 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-slide-up">
              <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded bg-neutral-950 text-white font-mono text-xs font-bold">
                    <Info className="w-4 h-4" />
                  </span>
                  <h3 className="font-mono font-bold text-sm uppercase text-neutral-950">
                    How IRCTC AGENT Works
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHowItWorksOpen(false)}
                  className="text-neutral-400 hover:text-neutral-700 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-neutral-600 leading-relaxed font-sans">
                <div className="flex items-start gap-2.5">
                  <span className="font-mono font-bold text-neutral-950 bg-neutral-100 px-1.5 py-0.5 rounded text-[10px]">
                    01
                  </span>
                  <p>
                    <strong>Live Direct Search:</strong> Queries all direct Indian Railways trains between your
                    origin and destination for real-time seat availability across all travel classes.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="font-mono font-bold text-neutral-950 bg-neutral-100 px-1.5 py-0.5 rounded text-[10px]">
                    02
                  </span>
                  <p>
                    <strong>Corridor Geometry:</strong> Uses GPS Great-Circle distance and railway network hubs to
                    identify optimal transfer junctions along your journey corridor (detour ratio ≤ 1.35).
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="font-mono font-bold text-neutral-950 bg-neutral-100 px-1.5 py-0.5 rounded text-[10px]">
                    03
                  </span>
                  <p>
                    <strong>Layover Safety Validator:</strong> Checks departure & arrival timestamps with overnight
                    carryover, ensuring comfortable 60–360 min transfer buffers with station taxi alerts.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="font-mono font-bold text-neutral-950 bg-neutral-100 px-1.5 py-0.5 rounded text-[10px]">
                    04
                  </span>
                  <p>
                    <strong>Multi-Date Matrix & Platforms:</strong> Compare adjacent days in 1 click and inspect
                    exact platform numbers and stop durations before booking.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsHowItWorksOpen(false)}
                  className="px-4 py-2 bg-neutral-950 hover:bg-neutral-800 text-white font-mono text-xs font-bold rounded-lg transition"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-neutral-200 bg-white py-6 mt-12 text-center text-xs font-mono text-neutral-500">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-neutral-900">IRCTC AGENT</span>
              <span>&bull;</span>
              <span>Production Public Release v2.0</span>
            </div>

            <div className="flex items-center gap-4 text-neutral-600">
              <a
                href="https://www.irctc.co.in"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-neutral-950 transition flex items-center gap-1"
              >
                <span>Official IRCTC Portal</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
};

export default App;
