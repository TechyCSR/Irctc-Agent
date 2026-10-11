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
  X,
  SlidersHorizontal,
  Sun,
  Moon,
  Zap,
  RotateCcw,
  Trash2,
  ChevronDown
} from 'lucide-react';
import { StationInput } from './components/StationInput';
import { ItineraryCard } from './components/ItineraryCard';
import { AmbientRouteCanvas } from './components/AmbientRouteCanvas';
import { BootLoader } from './components/BootLoader';
import { TrainScheduleModal } from './components/TrainScheduleModal';
import { DateStripSelector } from './components/DateStripSelector';
import { CoachSeatVisualizerModal } from './components/CoachSeatVisualizerModal';
import { FareBreakdownModal } from './components/FareBreakdownModal';
import { WatchdogModal } from './components/WatchdogModal';
import { ExportShareModal } from './components/ExportShareModal';
import { SearchingRadarLoader } from './components/SearchingRadarLoader';
import { InteractiveTrainCanvas } from './components/InteractiveTrainCanvas';
import { ToastProvider, useToast } from './components/Toast';
import { useTheme } from './context/ThemeContext';
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

const IRCTC_QUOTAS = [
  { code: 'GN', label: 'General Quota (GN)', desc: 'Standard open allocation' },
  { code: 'TQ', label: 'Tatkal Quota (TQ)', desc: 'Emergency 1-day prior reservation' },
  { code: 'PT', label: 'Premium Tatkal (PT)', desc: 'Dynamic surge confirmed booking' },
  { code: 'LD', label: 'Ladies Quota (LD)', desc: 'Reserved for female solo travelers' },
  { code: 'SS', label: 'Senior Citizen (SS)', desc: 'Lower berth quota (60+ M / 45+ F)' },
  { code: 'HP', label: 'Divyangjan (HP)', desc: 'Physically disabled concession' },
  { code: 'FT', label: 'Foreign Tourist (FT)', desc: '365 days advance for international visitors' },
  { code: 'DF', label: 'Defence Quota (DF)', desc: 'Armed forces military warrant' },
];

const TRAIN_CATEGORIES = [
  { id: 'ALL', label: 'All Trains', badge: 'ALL' },
  { id: 'VANDE_BHARAT', label: 'Vande Bharat', badge: 'VB' },
  { id: 'RAJDHANI', label: 'Rajdhani', badge: 'RAJ' },
  { id: 'SHATABDI', label: 'Shatabdi', badge: 'SHT' },
  { id: 'TEJAS', label: 'Tejas', badge: 'TEJAS' },
  { id: 'DURONTO', label: 'Duronto', badge: 'DUR' },
  { id: 'AMRIT_BHARAT', label: 'Amrit Bharat', badge: 'AMRIT' },
  { id: 'GARIB_RATH', label: 'Garib/Humsafar', badge: 'GR' },
  { id: 'SUPERFAST', label: 'Superfast/Mail', badge: 'SF' },
];

function getTomorrowDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0];
}

const TODAY_ISO = new Date().toISOString().split('T')[0];

function formatDateToDDMMYYYY(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const separator = clean.includes('-') ? '-' : clean.includes('/') ? '/' : '';
  if (!separator) return clean;
  const parts = clean.split(separator);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD -> DD-MM-YYYY
      return `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
    }
    if (parts[2].length === 4) {
      // Already DD-MM-YYYY
      return `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
    }
  }
  return clean;
}

function formatDDMMYYYYToISO(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const separator = clean.includes('-') ? '-' : clean.includes('/') ? '/' : '';
  if (!separator) return clean;
  const parts = clean.split(separator);
  if (parts.length === 3) {
    if (parts[2].length === 4) {
      // DD-MM-YYYY -> YYYY-MM-DD
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    if (parts[0].length === 4) {
      // Already YYYY-MM-DD
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
  }
  return clean;
}

const MainApp: React.FC = () => {
  const { showToast } = useToast();
  const { toggleTheme, isDark } = useTheme();

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

  // Pagination limit: show first 12 routes, then load +5 each time
  const [visibleCount, setVisibleCount] = useState<number>(12);

  // Filters & sorting
  const [activeTab, setActiveTab] = useState<'ALL' | 'CONFIRMED' | 'DIRECT' | 'HACKS'>('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [hubFilter, setHubFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'SCORE' | 'DURATION' | 'FARE' | 'DEPARTURE'>('SCORE');
  const [textFilter, setTextFilter] = useState('');

  // Advanced Filters
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [sameStationOnly, setSameStationOnly] = useState(false);
  const [minLayoverMinutes, setMinLayoverMinutes] = useState(0);
  const [departureTimeWindow, setDepartureTimeWindow] = useState<'ALL' | 'MORNING' | 'AFTERNOON' | 'NIGHT'>('ALL');

  // Reset pagination when search parameters or filters change
  useEffect(() => {
    setVisibleCount(12);
  }, [activeTab, classFilter, categoryFilter, hubFilter, sortBy, textFilter, sameStationOnly, minLayoverMinutes, departureTimeWindow]);

  // Modal states
  const [activeScheduleTrain, setActiveScheduleTrain] = useState<{
    no: string;
    name: string;
    boarding: string;
    alighting: string;
  } | null>(null);

  const [activeCoachTrain, setActiveCoachTrain] = useState<{
    no: string;
    name: string;
  } | null>(null);

  const [activeFareBreakdown, setActiveFareBreakdown] = useState<{
    fare: number;
    travelClass: string;
    trainNo: string;
    trainName: string;
  } | null>(null);

  const [activeWatchdog, setActiveWatchdog] = useState<{
    trainNo: string;
    trainName: string;
    fromStn: string;
    toStn: string;
    travelClass: string;
  } | null>(null);

  const [activeExportShare, setActiveExportShare] = useState<RouteItinerary | null>(null);

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
  const saveRecentSearch = useCallback((from: StationItem, to: StationItem, date: string) => {
    setRecentSearches((prev) => {
      const updated = [
        { from, to, date },
        ...prev.filter(
          (s) => !(s.from.code === from.code && s.to.code === to.code)
        ),
      ].slice(0, 5);
      try {
        localStorage.setItem('irctc_agent_recent_searches', JSON.stringify(updated));
      } catch {
        // Ignore storage errors
      }
      return updated;
    });
  }, []);

  // Swap Stations
  const handleSwap = () => {
    const temp = fromStation;
    setFromStation(toStation);
    setToStation(temp);
  };

  // Reset Search & Recommendations
  const handleResetSearch = useCallback(() => {
    setFromStation(null);
    setToStation(null);
    setJourneyDate(getTomorrowDateStr());
    setQuota('GN');
    setClassFilter('ALL');
    setCategoryFilter('ALL');
    setHubFilter('ALL');
    setSortBy('SCORE');
    setTextFilter('');
    setShowAdvancedFilters(false);
    setSameStationOnly(false);
    setMinLayoverMinutes(0);
    setDepartureTimeWindow('ALL');
    setActiveTab('ALL');
    setRoutes([]);
    setHasSearched(false);
    setTotalEvaluated(0);
    setConfirmedCount(0);
    setLowestFare(0);
    setVisibleCount(12);
    window.history.replaceState(null, '', window.location.pathname);
    showToast('Search reset successfully', 'info');
  }, [showToast]);

  // Clear Recent Searches History
  const handleClearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem('irctc_agent_recent_searches');
    } catch {
      // Ignore storage errors
    }
    showToast('Recent searches cleared', 'info');
  }, [showToast]);

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
      setVisibleCount(12);

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
        setSearchStatusText(`Evaluating direct lines, same-train split tricks & intermediate corridor hubs...`);

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
    [classFilter, showToast, saveRecentSearch]
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
      if (activeTab === 'HACKS' && !it.lifehack_type) return false;

      // Train Category Filter
      if (categoryFilter !== 'ALL') {
        const matchesCat = it.primary_category === categoryFilter ||
          it.legs.some((l) => l.category?.category === categoryFilter);
        if (!matchesCat) return false;
      }

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
    categoryFilter,
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

      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans selection:bg-zinc-950 selection:text-white dark:selection:bg-white dark:selection:text-zinc-950">
        {/* Top Ambient Visualizer Header */}
        <header className="relative border-b border-zinc-200/80 dark:border-zinc-800/80 glass-card bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-30 overflow-hidden no-print transition-all">
          {/* Three.js Ambient Particle Grid Canvas */}
          <AmbientRouteCanvas
            isSearching={isSearching}
            className="absolute inset-0 w-full h-full opacity-30 dark:opacity-20 pointer-events-none"
          />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="p-2 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-mono text-sm font-bold flex items-center justify-center shadow-xs">
                    <Train className="w-4 h-4" />
                  </span>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight uppercase font-mono text-zinc-950 dark:text-white">
                      IRCTC AGENT
                    </h1>
                    <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      Confirmed Ticket Discovery • Same-Train Splits • Alternate Boarding
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 font-mono text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  8,566 STATIONS
                </span>

                {/* Reset Search Button in Header */}
                {(fromStation || toStation || hasSearched) && (
                  <button
                    type="button"
                    onClick={handleResetSearch}
                    title="Reset search and return to initial view"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 hover:border-zinc-900 dark:hover:border-zinc-100 text-xs font-mono font-medium text-zinc-700 dark:text-zinc-300 transition bg-white dark:bg-zinc-900 active:scale-95"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                )}

                {/* Dark Mode Theme Toggle */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  title={`Switch to ${isDark ? 'Light' : 'OLED Dark'} Theme`}
                  className="p-2 rounded-full border border-zinc-200 dark:border-zinc-800 hover:border-zinc-900 dark:hover:border-zinc-100 text-zinc-700 dark:text-zinc-300 transition bg-white dark:bg-zinc-900"
                >
                  {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-700" />}
                </button>

                <button
                  type="button"
                  onClick={() => setIsHowItWorksOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-zinc-300 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-zinc-100 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition bg-white dark:bg-zinc-900"
                >
                  <Info className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                  <span>How It Works</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Body */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
          {/* Search Control Card with Glass Panel (Enlarged & Primary Focus) */}
          <div className="glass-card bg-white/95 dark:bg-zinc-900/95 border border-zinc-200/90 dark:border-zinc-800/90 rounded-3xl p-6 sm:p-8 lg:p-9 shadow-2xl dark:shadow-2xl no-print transition-all ring-1 ring-zinc-950/5 dark:ring-white/10">
            {/* Focused Search Card Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-3 border-b border-zinc-100 dark:border-zinc-800/80">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-xs sm:text-sm font-bold uppercase tracking-wider text-zinc-950 dark:text-white">
                  Smart Route Finder & Confirmed Berth Optimization
                </span>
              </div>
              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                8,566 Broad Gauge Stations Network
              </span>
            </div>

            <form onSubmit={handleSearchSubmit} className="space-y-5">
              {/* Origin & Destination Inputs with Swap */}
              <div className="grid grid-cols-1 md:grid-cols-11 gap-3.5 items-end">
                <div className="md:col-span-5">
                  <StationInput
                    label="From Station"
                    value={fromStation}
                    onChange={setFromStation}
                    placeholder="Search any origin station or city..."
                    size="lg"
                  />
                </div>

                <div className="md:col-span-1 flex items-center justify-center pb-0.5">
                  <button
                    type="button"
                    onClick={handleSwap}
                    title="Swap Origin and Destination"
                    className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-white bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 transition active:scale-95 shadow-xs"
                  >
                    <ArrowRightLeft className="w-4.5 h-4.5" />
                  </button>
                </div>

                <div className="md:col-span-5">
                  <StationInput
                    label="To Station"
                    value={toStation}
                    onChange={setToStation}
                    placeholder="Search any destination station or city..."
                    size="lg"
                  />
                </div>
              </div>

              {/* Date, Quota, Class, and Submit Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 pt-2">
                {/* Journey Date */}
                <div>
                  <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-2">
                    Journey Date
                  </label>
                  <input
                    type="date"
                    value={journeyDate}
                    min={TODAY_ISO}
                    onChange={(e) => setJourneyDate(e.target.value)}
                    className="w-full px-4 py-3.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-base font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white transition shadow-xs"
                  />
                </div>

                {/* Quota (All 8 IRCTC Quotas) */}
                <div>
                  <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-2">
                    Quota
                  </label>
                  <select
                    value={quota}
                    onChange={(e) => setQuota(e.target.value)}
                    className="w-full px-4 py-3.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-base font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white transition shadow-xs"
                  >
                    {IRCTC_QUOTAS.map((q) => (
                      <option key={q.code} value={q.code}>
                        {q.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Preferred Class */}
                <div>
                  <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-2">
                    Preferred Class
                  </label>
                  <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="w-full px-4 py-3.5 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-base font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-zinc-950 dark:focus:ring-white transition shadow-xs"
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

                {/* Search Submit & Reset Action */}
                <div className="flex items-end gap-2">
                  <button
                    type="submit"
                    disabled={isSearching}
                    className="flex-1 py-3.5 px-6 rounded-xl bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:bg-zinc-400 text-white dark:text-zinc-950 font-mono text-base font-bold flex items-center justify-center gap-2.5 transition shadow-md hover:shadow-lg active:scale-[0.98]"
                  >
                    {isSearching ? (
                      <>
                        <div className="w-4.5 h-4.5 border-2 border-white dark:border-zinc-950 border-t-transparent rounded-full animate-spin" />
                        <span>SEARCHING...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4.5 h-4.5" />
                        <span>FIND SEATS</span>
                      </>
                    )}
                  </button>

                  {(fromStation || toStation || hasSearched) && (
                    <button
                      type="button"
                      onClick={handleResetSearch}
                      title="Clear search inputs and reset results"
                      className="py-3.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-zinc-200 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition active:scale-95 flex items-center gap-1.5 font-mono text-xs font-bold shadow-xs"
                    >
                      <RotateCcw className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                      <span className="hidden md:inline">Reset</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Advanced Filter Toggle & Popular Presets Row */}
              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500 font-bold mr-1">
                    Popular Routes:
                  </span>
                  {POPULAR_PAIRS.map((pair) => (
                    <button
                      key={`${pair.from.code}-${pair.to.code}`}
                      type="button"
                      onClick={() => selectPopularPair(pair)}
                      className="px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-zinc-300 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-[11px] font-mono transition"
                    >
                      {pair.from.code} → {pair.to.code}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="inline-flex items-center gap-1 text-xs font-mono text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white self-start sm:self-auto font-medium transition"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>{showAdvancedFilters ? 'Hide Filters' : 'More Filters'}</span>
                </button>
              </div>

              {/* Collapsible Advanced Filters Drawer */}
              {showAdvancedFilters && (
                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-slide-up">
                  {/* Same Station Transfer */}
                  <label className="flex items-center gap-2 cursor-pointer font-mono text-zinc-800 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      checked={sameStationOnly}
                      onChange={(e) => setSameStationOnly(e.target.checked)}
                      className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-zinc-900"
                    />
                    <span>Same Station Only (No taxi transit)</span>
                  </label>

                  {/* Layover buffer */}
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-zinc-500 dark:text-zinc-400 font-bold mb-1">
                      Min Layover Buffer
                    </label>
                    <select
                      value={minLayoverMinutes}
                      onChange={(e) => setMinLayoverMinutes(parseInt(e.target.value, 10))}
                      className="w-full px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none"
                    >
                      <option value={0}>Any Layover (1h+)</option>
                      <option value={120}>Min 2 Hours</option>
                      <option value={180}>Min 3 Hours</option>
                      <option value={240}>Min 4 Hours</option>
                    </select>
                  </div>

                  {/* Departure window */}
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-zinc-500 dark:text-zinc-400 font-bold mb-1">
                      Departure Time
                    </label>
                    <select
                      value={departureTimeWindow}
                      onChange={(e) => setDepartureTimeWindow(e.target.value as any)}
                      className="w-full px-2 py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded font-mono text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none"
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
                <div className="pt-2 flex flex-wrap items-center justify-between gap-1.5 text-xs border-t border-zinc-100 dark:border-zinc-800/80">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500 font-bold mr-1 flex items-center gap-1">
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
                        className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-[11px] font-mono transition flex items-center gap-1 border border-transparent hover:border-zinc-300 dark:hover:border-zinc-600"
                      >
                        <span>{rec.from.code} → {rec.to.code}</span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">({rec.date})</span>
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleClearRecentSearches}
                    className="text-[10px] font-mono text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition flex items-center gap-1 py-0.5 px-1.5 rounded"
                    title="Clear recent searches history"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear History</span>
                  </button>
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

          {/* Real-time Search Progress & Animated Radar Pathfinder Loader */}
          {isSearching && (
            <SearchingRadarLoader
              originCode={fromStation?.code}
              originName={fromStation?.name}
              destCode={toStation?.code}
              destName={toStation?.name}
              statusText={searchStatusText}
            />
          )}

          {/* Results Section */}
          {hasSearched && (
            <div className="space-y-4">
              {/* Results Header Summary Bar */}
              <div className="glass-card bg-white/85 dark:bg-zinc-900/85 border border-zinc-200/90 dark:border-zinc-800/90 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500 block font-bold">
                      Journey Corridor
                    </span>
                    <span className="text-sm font-mono font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                      {fromStation?.code} ({fromStation?.name}) → {toStation?.code} ({toStation?.name})
                    </span>
                  </div>
                  <div className="h-6 w-px bg-zinc-200 dark:border-zinc-800 hidden sm:block" />
                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500 block font-bold">
                      Evaluated
                    </span>
                    <span className="text-sm font-mono font-bold text-zinc-900 dark:text-zinc-100">
                      {totalEvaluated} routes
                    </span>
                  </div>
                  <div className="h-6 w-px bg-zinc-200 dark:border-zinc-800 hidden sm:block" />
                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500 block font-bold">
                      Confirmed Options
                    </span>
                    <span className="text-sm font-mono font-bold text-zinc-950 dark:text-white">
                      {confirmedCount} available
                    </span>
                  </div>
                  {lowestFare > 0 && (
                    <>
                      <div className="h-6 w-px bg-zinc-200 dark:border-zinc-800 hidden sm:block" />
                      <div>
                        <span className="text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500 block font-bold">
                          Lowest Fare
                        </span>
                        <span className="text-sm font-mono font-bold text-zinc-950 dark:text-white">
                          ₹{lowestFare}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Quick Tab Filters & Reset Action */}
                <div className="flex items-center gap-2 self-start md:self-auto">
                  <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setActiveTab('ALL')}
                      className={`px-3 py-1 rounded text-xs font-mono font-bold transition ${
                        activeTab === 'ALL'
                          ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-2xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      All ({routes.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('CONFIRMED')}
                      className={`px-3 py-1 rounded text-xs font-mono font-bold transition ${
                        activeTab === 'CONFIRMED'
                          ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-2xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      Confirmed ({confirmedCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('HACKS')}
                      className={`px-3 py-1 rounded text-xs font-mono font-bold transition flex items-center gap-1 ${
                        activeTab === 'HACKS'
                          ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-2xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      <Zap className="w-3 h-3 text-amber-500" />
                      Lifehacks
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('DIRECT')}
                      className={`px-3 py-1 rounded text-xs font-mono font-bold transition ${
                        activeTab === 'DIRECT'
                          ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-2xs'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      Direct Only
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetSearch}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:border-zinc-900 dark:hover:border-white text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
                    title="Reset search and return to initial view"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Train Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-print">
                <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold shrink-0 mr-1">
                  Train Type:
                </span>
                {TRAIN_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryFilter(cat.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono shrink-0 transition border ${
                      categoryFilter === cat.id
                        ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold border-zinc-950 dark:border-white shadow-2xs'
                        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Filter & Sort Controls Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs no-print">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Intermediate Hub Filter */}
                  {availableHubs.length > 0 && (
                    <select
                      value={hubFilter}
                      onChange={(e) => setHubFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg font-mono text-zinc-800 dark:text-zinc-200 text-xs focus:outline-none focus:border-zinc-900 dark:focus:border-white"
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
                    className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 dark:focus:border-white w-52"
                  />
                </div>

                {/* Sort Dropdown */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <span className="text-zinc-400 font-mono text-[11px] uppercase font-bold flex items-center gap-1">
                    <ArrowUpDown className="w-3 h-3" /> Sort:
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg font-mono text-zinc-800 dark:text-zinc-200 text-xs focus:outline-none focus:border-zinc-900 dark:focus:border-white"
                  >
                    <option value="SCORE">Recommended (Best Match)</option>
                    <option value="DURATION">Shortest Travel Time</option>
                    <option value="FARE">Lowest Combined Fare</option>
                    <option value="DEPARTURE">Earliest Departure</option>
                  </select>
                </div>
              </div>

              {/* Itinerary Cards List with Pagination */}
              {displayedRoutes.length > 0 ? (
                <div className="space-y-4">
                  {displayedRoutes.slice(0, visibleCount).map((itinerary) => (
                    <ItineraryCard
                      key={itinerary.id}
                      itinerary={itinerary}
                      fromName={fromStation?.name || itinerary.origin}
                      toName={toStation?.name || itinerary.destination}
                      doj={journeyDate}
                      onOpenSchedule={(no, name, boarding, alighting) =>
                        setActiveScheduleTrain({ no, name, boarding, alighting })
                      }
                      onOpenCoachLayout={(no, name) =>
                        setActiveCoachTrain({ no, name })
                      }
                      onOpenFareBreakdown={(fare, cls, no, name) =>
                        setActiveFareBreakdown({ fare, travelClass: cls, trainNo: no, trainName: name })
                      }
                      onOpenWatchdog={(no, name, fromStn, toStn, cls) =>
                        setActiveWatchdog({ trainNo: no, trainName: name, fromStn, toStn, travelClass: cls })
                      }
                      onOpenExportShare={(itin) =>
                        setActiveExportShare(itin)
                      }
                    />
                  ))}

                  {/* Load More Button (+5 Options) */}
                  {visibleCount < displayedRoutes.length && (
                    <div className="pt-4 pb-2 flex flex-col items-center justify-center gap-2.5 no-print">
                      <button
                        type="button"
                        onClick={() => setVisibleCount((prev) => prev + 5)}
                        className="px-6 py-2.5 rounded-xl bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-mono text-xs font-bold transition shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
                      >
                        <span>LOAD MORE OPTIONS (+{Math.min(5, displayedRoutes.length - visibleCount)})</span>
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                        Showing {Math.min(visibleCount, displayedRoutes.length)} of {displayedRoutes.length} options
                      </span>
                    </div>
                  )}

                  {visibleCount >= displayedRoutes.length && displayedRoutes.length > 12 && (
                    <div className="py-4 text-center text-xs font-mono text-zinc-400 dark:text-zinc-500 no-print">
                      All {displayedRoutes.length} route options displayed
                    </div>
                  )}
                </div>
              ) : !isSearching ? (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-12 text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-zinc-400 mx-auto" />
                  <h3 className="text-base font-mono font-bold text-zinc-900 dark:text-white">
                    No matching route options found
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                    Try switching filters (e.g. choose "All Classes" or reset the transfer hub filter),
                    or pick an adjacent travel date from the matrix above.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('ALL');
                      setCategoryFilter('ALL');
                      setHubFilter('ALL');
                      setClassFilter('ALL');
                      setTextFilter('');
                      setSameStationOnly(false);
                      setMinLayoverMinutes(0);
                      setDepartureTimeWindow('ALL');
                    }}
                    className="px-3.5 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 transition"
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
                      className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 space-y-4 animate-pulse"
                    >
                      <div className="flex justify-between items-center">
                        <div className="h-6 w-32 bg-zinc-200 dark:bg-zinc-800 rounded" />
                        <div className="h-6 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
                      </div>
                      <div className="h-20 bg-zinc-100 dark:bg-zinc-800/60 rounded-lg" />
                      <div className="h-10 bg-zinc-100 dark:bg-zinc-800/60 rounded-lg" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Realistic 3D Interactive Moving Train Visualizer (before search or after reset) - Hidden on mobile screens */}
          {!hasSearched && (
            <div className="hidden md:block max-w-4xl mx-auto w-full space-y-4 animate-slide-up">
              <InteractiveTrainCanvas isDark={isDark} />
            </div>
          )}
        </main>

        {/* Modal: Train Schedule & Platform Stops */}
        {activeScheduleTrain && (
          <TrainScheduleModal
            trainNo={activeScheduleTrain.no}
            trainName={activeScheduleTrain.name}
            boardingCode={activeScheduleTrain.boarding}
            alightingCode={activeScheduleTrain.alighting}
            onClose={() => setActiveScheduleTrain(null)}
          />
        )}

        {/* Modal: Coach Composition & Berth Seat Map */}
        {activeCoachTrain && (
          <CoachSeatVisualizerModal
            trainNo={activeCoachTrain.no}
            trainName={activeCoachTrain.name}
            isOpen={true}
            onClose={() => setActiveCoachTrain(null)}
          />
        )}

        {/* Modal: Official Fare Breakdown */}
        {activeFareBreakdown && (
          <FareBreakdownModal
            isOpen={true}
            fare={activeFareBreakdown.fare}
            travelClass={activeFareBreakdown.travelClass}
            trainNo={activeFareBreakdown.trainNo}
            trainName={activeFareBreakdown.trainName}
            onClose={() => setActiveFareBreakdown(null)}
          />
        )}

        {/* Modal: Seat Watchdog Alert Subscription */}
        {activeWatchdog && (
          <WatchdogModal
            isOpen={true}
            trainNo={activeWatchdog.trainNo}
            trainName={activeWatchdog.trainName}
            doj={journeyDate}
            fromStn={activeWatchdog.fromStn}
            toStn={activeWatchdog.toStn}
            travelClass={activeWatchdog.travelClass}
            quota={quota}
            onClose={() => setActiveWatchdog(null)}
          />
        )}

        {/* Modal: Export & WhatsApp Travel Card */}
        {activeExportShare && (
          <ExportShareModal
            isOpen={true}
            itinerary={activeExportShare}
            fromName={fromStation?.name || activeExportShare.origin}
            toName={toStation?.name || activeExportShare.destination}
            doj={journeyDate}
            onClose={() => setActiveExportShare(null)}
          />
        )}

        {/* "How It Works" Modal */}
        {isHowItWorksOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-slide-up">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-mono text-xs font-bold">
                    <Info className="w-4 h-4" />
                  </span>
                  <h3 className="font-mono font-bold text-sm uppercase text-zinc-950 dark:text-white">
                    How IRCTC AGENT Works
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHowItWorksOpen(false)}
                  className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-sans">
                <div className="flex items-start gap-2.5">
                  <span className="font-mono font-bold text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[10px]">
                    01
                  </span>
                  <p>
                    <strong>Live Direct Search:</strong> Queries all direct Indian Railways trains between your
                    origin and destination for real-time seat availability across all 8 IRCTC travel quotas.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="font-mono font-bold text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[10px]">
                    02
                  </span>
                  <p>
                    <strong>Same-Train Split Trick:</strong> When end-to-end tickets are waitlisted, discovers intermediate
                    station split tickets on the <em>exact same train</em>, letting you travel on the same physical seat without changing trains!
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="font-mono font-bold text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[10px]">
                    03
                  </span>
                  <p>
                    <strong>Alternate Boarding Lifehack:</strong> Books from the train's originating terminal where General Quota
                    is abundantly confirmed, while officially boarding at your local station with zero penalty.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="font-mono font-bold text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[10px]">
                    04
                  </span>
                  <p>
                    <strong>Corridor Geometry & Safety:</strong> Evaluates comfortable 1-transfer connections across junction hubs
                    with cross-terminal taxi buffer calculation and 5-day availability comparison.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsHowItWorksOpen(false)}
                  className="px-4 py-2 bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-mono text-xs font-bold rounded-lg transition"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 py-6 mt-12 text-center text-xs font-mono text-zinc-500 dark:text-zinc-400 no-print">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-900 dark:text-white">IRCTC AGENT</span>
              <span>&bull;</span>
              <span>v2.0</span>
              <span>&bull;</span>
              <a
                href="https://techycsr.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-950 dark:hover:text-white transition font-medium text-zinc-700 dark:text-zinc-300 underline underline-offset-2 flex items-center gap-1"
              >
                <span>Developed by @TechyCSR</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center gap-4 text-zinc-600 dark:text-zinc-400">
              <a
                href="https://www.irctc.co.in"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-950 dark:hover:text-white transition flex items-center gap-1"
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
