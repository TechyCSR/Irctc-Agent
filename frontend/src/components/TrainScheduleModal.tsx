import React, { useState, useEffect } from 'react';
import { X, Search, Clock, UtensilsCrossed, Star } from 'lucide-react';
import { getTrainSchedule } from '../services/api';
import type { TrainScheduleResponse } from '../types';

interface TrainScheduleModalProps {
  trainNo: string;
  trainName: string;
  boardingCode?: string;
  alightingCode?: string;
  onClose: () => void;
}

export const TrainScheduleModal: React.FC<TrainScheduleModalProps> = ({
  trainNo,
  trainName,
  boardingCode,
  alightingCode,
  onClose,
}) => {
  const [schedule, setSchedule] = useState<TrainScheduleResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    getTrainSchedule(trainNo)
      .then((data) => {
        if (isMounted) {
          setSchedule(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load train schedule');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [trainNo]);

  const filteredStops = (schedule?.stops || []).filter((s) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/60 backdrop-blur-xs">
      <div className="bg-white border border-zinc-200 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-sm bg-zinc-950 text-white px-2 py-0.5 rounded">
                #{trainNo}
              </span>
              <h2 className="text-base font-bold text-zinc-950">
                {schedule?.train_name || trainName}
              </h2>
            </div>
            {schedule && (
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-zinc-500 mt-1">
                <span>{schedule.source} → {schedule.destination}</span>
                <span>&bull;</span>
                <span>{schedule.total_duration}</span>
                {schedule.has_pantry && (
                  <>
                    <span>&bull;</span>
                    <span className="inline-flex items-center gap-1 text-zinc-800 font-semibold">
                      <UtensilsCrossed className="w-3 h-3" /> Pantry Available
                    </span>
                  </>
                )}
                {schedule.punctuality_rating && (
                  <>
                    <span>&bull;</span>
                    <span className="inline-flex items-center gap-1 text-zinc-800 font-semibold">
                      <Star className="w-3 h-3 fill-zinc-900 text-zinc-900" />
                      {schedule.punctuality_rating}/5.0 Punctuality
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-zinc-200 hover:border-zinc-900 text-zinc-400 hover:text-zinc-900 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Input */}
        <div className="px-5 py-2.5 border-b border-zinc-100 bg-white">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search station stops or codes..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-zinc-200 rounded-lg text-xs font-mono text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950"
            />
          </div>
        </div>

        {/* Stops List */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-6 h-6 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-mono text-zinc-500">Loading route schedule and platform data...</p>
            </div>
          ) : error ? (
            <div className="py-12 text-center text-xs font-mono text-zinc-500 space-y-2">
              <p>{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1 bg-zinc-950 text-white rounded text-xs"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-0 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-zinc-200">
              {filteredStops.map((stop, idx) => {
                const isBoarding = stop.code === boardingCode;
                const isAlighting = stop.code === alightingCode;
                const isHighlighted = isBoarding || isAlighting;

                return (
                  <div
                    key={`${stop.code}-${idx}`}
                    className={`relative flex items-start gap-4 py-3 pl-8 rounded-lg transition-colors ${
                      isHighlighted ? 'bg-zinc-100/80' : 'hover:bg-zinc-50'
                    }`}
                  >
                    {/* Timeline Node */}
                    <div
                      className={`absolute left-2.5 top-4 w-2.5 h-2.5 rounded-full -translate-x-1/2 transition-all ${
                        isHighlighted
                          ? 'bg-zinc-950 ring-4 ring-zinc-300'
                          : 'bg-zinc-400'
                      }`}
                    />

                    {/* Stop Info */}
                    <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-zinc-900 text-sm">
                            {stop.name}
                          </span>
                          <span className="font-mono text-[11px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                            {stop.code}
                          </span>
                          {isBoarding && (
                            <span className="font-mono text-[10px] font-bold bg-zinc-900 text-white px-2 py-0.5 rounded-full">
                              YOUR BOARDING
                            </span>
                          )}
                          {isAlighting && (
                            <span className="font-mono text-[10px] font-bold bg-zinc-900 text-white px-2 py-0.5 rounded-full">
                              YOUR DESTINATION
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                          {stop.distance_km} km &bull; Day {stop.day}
                        </div>
                      </div>

                      {/* Timings & Platform */}
                      <div className="flex items-center gap-3 sm:text-right font-mono self-start sm:self-auto">
                        <div>
                          <div className="text-zinc-900 font-bold">
                            {stop.arrival && stop.arrival !== '--:--' ? stop.arrival : 'Origin'} →{' '}
                            {stop.departure && stop.departure !== '--:--' ? stop.departure : 'Terminus'}
                          </div>
                          {stop.halt && (
                            <div className="text-[10px] text-zinc-500 flex items-center sm:justify-end gap-1">
                              <Clock className="w-2.5 h-2.5" /> {stop.halt}
                            </div>
                          )}
                        </div>

                        {stop.platform && (
                          <span className="font-mono text-xs font-bold px-2 py-1 bg-zinc-950 text-white rounded">
                            PF {stop.platform}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 text-white font-mono text-xs font-bold transition"
          >
            Close Schedule
          </button>
        </div>
      </div>
    </div>
  );
};
