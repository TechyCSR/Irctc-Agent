import React, { useState, useEffect } from 'react';
import {
  Train,
  ArrowRightLeft,
  Search,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Zap
} from 'lucide-react';
import { StationInput } from './components/StationInput';
import { ItineraryCard } from './components/ItineraryCard';
import type { RouteItinerary, StationItem } from './types';

export const App: React.FC = () => {
  // Search parameters
  const [fromStation, setFromStation] = useState<StationItem | null>({
    code: 'JU',
    name: 'Jodhpur Junction',
    city: 'Jodhpur',
    state: 'Rajasthan',
    cluster: 'JODHPUR'
  });

  const [toStation, setToStation] = useState<StationItem | null>({
    code: 'SBC',
    name: 'KSR Bengaluru City Junction',
    city: 'Bengaluru',
    state: 'Karnataka',
    cluster: 'BENGALURU'
  });

  const [journeyDate, setJourneyDate] = useState('2026-11-11');
  const [quota, setQuota] = useState('GN');

  // Results & status
  const [routes, setRoutes] = useState<RouteItinerary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgressText, setSearchProgressText] = useState('');
  const [totalEvaluated, setTotalEvaluated] = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [lowestFare, setLowestFare] = useState(0);

  // Filters
  const [activeTab, setActiveTab] = useState<'ALL' | 'CONFIRMED' | 'DIRECT'>('ALL');
  const [classFilter, setClassFilter] = useState('ALL');
  const [corridorFilter, setCorridorFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('SCORE');
  const [queryFilter, setQueryFilter] = useState('');

  // Swap stations
  const handleSwap = () => {
    const temp = fromStation;
    setFromStation(toStation);
    setToStation(temp);
  };

  // Perform search
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!fromStation || !toStation) return;

    setIsSearching(true);
    setSearchProgressText('Connecting to Indian Railways reservation engine...');
    setRoutes([]);

    // Format date from YYYY-MM-DD to DD-MM-YYYY
    const [y, m, d] = journeyDate.split('-');
    const formattedDate = `${d}-${m}-${y}`;

    try {
      const url = `/api/search?from=${fromStation.code}&to=${toStation.code}&date=${formattedDate}&quota=${quota}`;
      setSearchProgressText('Fetching direct trains & scanning optimal junction hubs...');
      const resp = await fetch(url);
      const data = await resp.json();

      if (data.status === 'success') {
        setRoutes(data.routes || []);
        setTotalEvaluated(data.total_evaluated || 0);
        setConfirmedCount(data.total_confirmed || 0);
        setLowestFare(data.lowest_fare || 0);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
      setSearchProgressText('');
    }
  };

  // Initial search on mount
  useEffect(() => {
    handleSearch();
  }, []);

  // Filter & sort routes
  const filteredRoutes = routes.filter((it) => {
    if (activeTab === 'CONFIRMED' && it.booking_confidence !== 'CONFIRMED') return false;
    if (activeTab === 'DIRECT' && it.type !== 'DIRECT') return false;

    if (classFilter !== 'ALL') {
      const hasCls = it.legs.every((l) => l.seats[classFilter] !== undefined);
      if (!hasCls) return false;
    }

    if (corridorFilter === 'PRIMARY' && (it.detour_ratio > 1.25 || it.is_detour)) return false;
    if (corridorFilter === 'DETOUR' && !it.is_detour) return false;

    if (queryFilter) {
      const q = queryFilter.toLowerCase();
      const match =
        it.corridor.toLowerCase().includes(q) ||
        it.hub.toLowerCase().includes(q) ||
        it.legs.some((l) => l.train_name.toLowerCase().includes(q) || l.train_no.includes(q));
      if (!match) return false;
    }

    return true;
  });

  if (sortBy === 'FARE_LOW') {
    filteredRoutes.sort((a, b) => (a.best_fare || 99999) - (b.best_fare || 99999));
  } else if (sortBy === 'DURATION_SHORT') {
    filteredRoutes.sort((a, b) => a.total_duration_minutes - b.total_duration_minutes);
  } else if (sortBy === 'LAYOVER_SHORT') {
    filteredRoutes.sort((a, b) => a.layover_minutes - b.layover_minutes);
  } else {
    filteredRoutes.sort((a, b) => b.score - a.score);
  }

  // Quick popular origin chips
  const popularPresets = [
    { from: { code: 'NDLS', name: 'New Delhi', city: 'Delhi', state: 'Delhi', cluster: 'DELHI' }, to: { code: 'CSMT', name: 'Mumbai CSMT', city: 'Mumbai', state: 'Maharashtra', cluster: 'MUMBAI' } },
    { from: { code: 'JU', name: 'Jodhpur Junction', city: 'Jodhpur', state: 'Rajasthan', cluster: 'JODHPUR' }, to: { code: 'SBC', name: 'KSR Bengaluru', city: 'Bengaluru', state: 'Karnataka', cluster: 'BENGALURU' } },
    { from: { code: 'NDLS', name: 'New Delhi', city: 'Delhi', state: 'Delhi', cluster: 'DELHI' }, to: { code: 'HWH', name: 'Howrah Junction', city: 'Kolkata', state: 'West Bengal', cluster: 'KOLKATA' } },
    { from: { code: 'MAS', name: 'Chennai Central', city: 'Chennai', state: 'Tamil Nadu', cluster: 'CHENNAI' }, to: { code: 'SBC', name: 'KSR Bengaluru', city: 'Bengaluru', state: 'Karnataka', cluster: 'BENGALURU' } },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <Train className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-extrabold text-slate-900 tracking-tight">
                  IRCTC Smart Ticket Agent
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                  Universal Search
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Autonomous Confirmed Seat Finder for any station & date across India
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center space-x-2">
            <span className="text-xs text-slate-500 font-medium">Public Global Version 2.0</span>
          </div>
        </div>
      </header>

      {/* Main Search Panel */}
      <section className="bg-white border-b border-slate-200 pt-6 pb-8 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              {/* Origin Station */}
              <div className="md:col-span-4">
                <StationInput
                  label="From Station / City"
                  value={fromStation}
                  onChange={setFromStation}
                  placeholder="e.g. Jodhpur, Delhi, Mumbai..."
                />
              </div>

              {/* Swap Button */}
              <div className="md:col-span-1 flex items-center justify-center pb-1">
                <button
                  type="button"
                  onClick={handleSwap}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition border border-slate-200"
                  title="Swap stations"
                >
                  <ArrowRightLeft className="w-4 h-4 text-slate-700" />
                </button>
              </div>

              {/* Destination Station */}
              <div className="md:col-span-4">
                <StationInput
                  label="To Station / City"
                  value={toStation}
                  onChange={setToStation}
                  placeholder="e.g. Bengaluru, Howrah, Chennai..."
                />
              </div>

              {/* Date */}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Journey Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={journeyDate}
                    onChange={(e) => setJourneyDate(e.target.value)}
                    className="w-full pl-3 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>
              </div>

              {/* Search Button */}
              <div className="md:col-span-1">
                <button
                  type="submit"
                  disabled={isSearching}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl text-sm transition shadow-sm flex items-center justify-center space-x-1.5 h-[42px]"
                >
                  {isSearching ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span className="hidden md:inline">Find</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quota Selector & Popular Presets */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-slate-400 font-medium">Quick Routes:</span>
                {popularPresets.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setFromStation(p.from);
                      setToStation(p.to);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition"
                  >
                    {p.from.city} → {p.to.city}
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-slate-400 font-medium">Quota:</span>
                <select
                  value={quota}
                  onChange={(e) => setQuota(e.target.value)}
                  className="bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="GN">General (GN)</option>
                  <option value="TQ">Tatkal (TQ)</option>
                  <option value="LD">Ladies (LD)</option>
                </select>
              </div>
            </div>
          </form>

          {/* Real-time Streaming Search Progress Ticker */}
          {isSearching && (
            <div className="mt-4 p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center space-x-3 text-xs text-indigo-900 animate-pulse">
              <Zap className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{searchProgressText}</span>
            </div>
          )}

          {/* Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Options Found
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 block">
                {totalEvaluated}
              </span>
              <span className="text-[11px] text-slate-400">Direct & connecting</span>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
                100% Confirmed Routes
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-700 mt-0.5 block">
                {confirmedCount}
              </span>
              <span className="text-[11px] text-emerald-600">Available on both legs</span>
            </div>

            <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider block">
                Lowest Combined Fare
              </span>
              <span className="text-xl sm:text-2xl font-black text-indigo-700 mt-0.5 block">
                {lowestFare > 0 ? `₹${lowestFare}` : '—'}
              </span>
              <span className="text-[11px] text-indigo-600">Total travel cost</span>
            </div>

            <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5">
              <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider block">
                Smart Pathfinder
              </span>
              <span className="text-sm font-bold text-blue-900 mt-1 block">
                Dynamic Hub Selection
              </span>
              <span className="text-[11px] text-blue-600">Minimal travel detour</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Results Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Filter and Tab Controls */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Options ({routes.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('CONFIRMED')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                activeTab === 'CONFIRMED'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>100% Confirmed Only</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('DIRECT')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'DIRECT'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Direct Trains Only
            </button>
          </div>

          {/* Secondary Controls: Class, Corridor, Sort */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Search filter */}
            <input
              type="text"
              value={queryFilter}
              onChange={(e) => setQueryFilter(e.target.value)}
              placeholder="Filter by train or hub..."
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none w-40"
            />

            {/* Class */}
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Classes</option>
              <option value="3A">3A (AC 3 Tier)</option>
              <option value="2A">2A (AC 2 Tier)</option>
              <option value="SL">SL (Sleeper)</option>
              <option value="1A">1A (First AC)</option>
              <option value="3E">3E (3 AC Economy)</option>
            </select>

            {/* Corridor */}
            <select
              value={corridorFilter}
              onChange={(e) => setCorridorFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">All Corridors (Inclusive)</option>
              <option value="PRIMARY">Primary Corridor Only</option>
              <option value="DETOUR">Detour Fallbacks</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-700 focus:outline-none"
            >
              <option value="SCORE">Recommendation #1 (Optimal Score)</option>
              <option value="FARE_LOW">Lowest Total Fare (₹)</option>
              <option value="DURATION_SHORT">Shortest Total Duration</option>
              <option value="LAYOVER_SHORT">Shortest Layover</option>
            </select>
          </div>
        </div>

        {/* Results Counter */}
        <div className="flex items-center justify-between mb-4 text-xs text-slate-500 font-medium">
          <div>
            Showing <strong className="text-slate-900">{filteredRoutes.length}</strong> travel combinations
          </div>
          <div>
            Sorted by: <strong className="text-slate-900">Recommendation Rank</strong>
          </div>
        </div>

        {/* Itinerary Cards Feed */}
        <div className="space-y-4">
          {filteredRoutes.length > 0 ? (
            filteredRoutes.map((itin) => (
              <ItineraryCard key={itin.id} itinerary={itin} />
            ))
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500 shadow-xs">
              <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No matching routes found</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Try selecting "All Options" or searching a different date to explore available connecting routes.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Clean Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4">
          <p className="font-semibold text-slate-700">IRCTC Universal Agent & Multi-Hop Pathfinder</p>
          <p className="mt-1">
            Real-time data fetched live from Indian Railways national reservation engine. Public GN Quota only.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
