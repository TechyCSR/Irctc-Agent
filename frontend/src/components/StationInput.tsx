import React, { useState, useEffect, useRef } from 'react';
import { Search, Building2, X } from 'lucide-react';
import type { StationItem } from '../types';
import { searchStations } from '../services/api';

interface StationInputProps {
  label: string;
  value: StationItem | null;
  onChange: (station: StationItem | null) => void;
  placeholder?: string;
}

export const StationInput: React.FC<StationInputProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Search by station code, name, or city...'
}) => {
  const [query, setQuery] = useState(value ? `${value.name} (${value.code})` : '');
  const [suggestions, setSuggestions] = useState<StationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      setQuery(`${value.name} (${value.code})`);
    } else {
      setQuery('');
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchStations = async (text: string) => {
    if (!text || text.trim().length < 1) {
      setSuggestions([]);
      return;
    }
    setIsLoading(true);
    try {
      const data = await searchStations(text);
      setSuggestions(data || []);
      setIsOpen(true);
    } catch (err) {
      console.error('Failed to search stations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (!val) {
      onChange(null);
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    fetchStations(val);
  };

  const handleClear = () => {
    setQuery('');
    onChange(null);
    setSuggestions([]);
    setIsOpen(false);
  };

  const handleSelect = (stn: StationItem) => {
    onChange(stn);
    setQuery(`${stn.name} (${stn.code})`);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
          {label}
        </label>
        {value && (
          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
            {value.code}
          </span>
        )}
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
          <Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
        </div>

        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
            else if (query) fetchStations(query);
          }}
          placeholder={placeholder}
          className="w-full pl-10 pr-9 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm font-semibold text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-950 dark:focus:ring-white focus:border-zinc-950 dark:focus:border-white transition-all shadow-xs"
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {isLoading && (
          <div className="absolute inset-y-0 right-8 pr-1 flex items-center">
            <div className="w-3.5 h-3.5 border-2 border-zinc-900 dark:border-zinc-100 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 glass-card bg-white/95 dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xl max-h-64 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/80">
          {suggestions.map((stn) => (
            <button
              key={stn.code}
              type="button"
              onClick={() => handleSelect(stn)}
              className="w-full text-left px-3.5 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <span className="w-14 text-center py-1 px-1.5 bg-zinc-100 dark:bg-zinc-800 group-hover:bg-zinc-900 dark:group-hover:bg-white text-zinc-900 dark:text-zinc-100 group-hover:text-white dark:group-hover:text-zinc-950 font-mono text-xs font-bold rounded transition-colors">
                  {stn.code}
                </span>
                <div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    {stn.name}
                    {stn.is_junction && (
                      <span className="text-[10px] font-mono uppercase bg-zinc-200/70 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-1 py-0.5 rounded text-[9px]">
                        JN
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {stn.city ? `${stn.city}, ` : ''}{stn.state}
                  </div>
                </div>
              </div>

              {stn.cluster && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                  <Building2 className="w-3 h-3" />
                  <span>Cluster</span>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
