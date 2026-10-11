import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Building2 } from 'lucide-react';
import type { StationItem } from '../types';

interface StationInputProps {
  label: string;
  value: StationItem | null;
  onChange: (station: StationItem) => void;
  placeholder?: string;
}

export const StationInput: React.FC<StationInputProps> = ({
  label,
  value,
  onChange,
  placeholder = 'Search station or city...'
}) => {
  const [query, setQuery] = useState(value ? `${value.name} (${value.code})` : '');
  const [suggestions, setSuggestions] = useState<StationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      setQuery(`${value.name} (${value.code})`);
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
    if (!text || text.length < 1) {
      setSuggestions([]);
      return;
    }
    setIsLoading(true);
    try {
      const resp = await fetch(`/api/stations/search?q=${encodeURIComponent(text)}`);
      const data = await resp.json();
      setSuggestions(data || []);
      setIsOpen(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    fetchStations(val);
  };

  const handleSelect = (stn: StationItem) => {
    onChange(stn);
    setQuery(`${stn.name} (${stn.code})`);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
        {label}
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
          <MapPin className="w-4 h-4 text-indigo-500" />
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
          className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-xs"
        />
        {isLoading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100">
          {suggestions.map((stn) => (
            <button
              key={stn.code}
              type="button"
              onClick={() => handleSelect(stn)}
              className="w-full text-left px-4 py-2.5 hover:bg-indigo-50/60 transition flex items-center justify-between group"
            >
              <div className="flex items-center space-x-2.5">
                <span className="w-12 text-center py-1 px-1.5 bg-indigo-100/80 text-indigo-800 text-xs font-extrabold rounded-md group-hover:bg-indigo-600 group-hover:text-white transition">
                  {stn.code}
                </span>
                <div>
                  <div className="text-sm font-semibold text-slate-900 group-hover:text-indigo-950">
                    {stn.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {stn.city}, {stn.state}
                  </div>
                </div>
              </div>
              {stn.cluster && (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                  <Building2 className="w-2.5 h-2.5" />
                  <span>City Cluster</span>
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
