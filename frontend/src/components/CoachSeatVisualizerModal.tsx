import React, { useState } from 'react';
import { X, Train, Info } from 'lucide-react';

interface CoachSeatVisualizerModalProps {
  trainNo: string;
  trainName: string;
  isOpen: boolean;
  onClose: () => void;
}

// Typical Indian Railways rake formation
const DEFAULT_COACH_FORMATION = [
  { code: 'LOCO', type: 'ENGINE', label: 'WAP-7 Loco' },
  { code: 'EOG', type: 'GEN', label: 'Generator Car' },
  { code: 'GS', type: 'GEN', label: 'General Unreserved' },
  { code: 'S1', type: 'SL', label: 'Sleeper Coach 1' },
  { code: 'S2', type: 'SL', label: 'Sleeper Coach 2' },
  { code: 'S3', type: 'SL', label: 'Sleeper Coach 3' },
  { code: 'S4', type: 'SL', label: 'Sleeper Coach 4' },
  { code: 'PC', type: 'PANTRY', label: 'Pantry Car' },
  { code: 'B1', type: '3A', label: 'AC 3 Tier (B1)' },
  { code: 'B2', type: '3A', label: 'AC 3 Tier (B2)' },
  { code: 'B3', type: '3A', label: 'AC 3 Tier (B3)' },
  { code: 'B4', type: '3A', label: 'AC 3 Tier (B4)' },
  { code: 'B5', type: '3A', label: 'AC 3 Tier (B5)' },
  { code: 'A1', type: '2A', label: 'AC 2 Tier (A1)' },
  { code: 'A2', type: '2A', label: 'AC 2 Tier (A2)' },
  { code: 'H1', type: '1A', label: 'First AC (H1)' },
  { code: 'GS', type: 'GEN', label: 'General Unreserved' },
  { code: 'SLR', type: 'GEN', label: 'Guard & Luggage' },
];

export const CoachSeatVisualizerModal: React.FC<CoachSeatVisualizerModalProps> = ({
  trainNo,
  trainName,
  isOpen,
  onClose,
}) => {
  const [selectedCoachClass, setSelectedCoachClass] = useState<'3A' | '2A' | 'SL' | 'CC'>('3A');
  const [searchBerth, setSearchBerth] = useState<string>('');

  if (!isOpen) return null;

  // Calculate Berth layout type for 3A / Sleeper (8-berth bay)
  const getBerthType = (berthNo: number, coachClass: string) => {
    if (coachClass === '3A' || coachClass === 'SL') {
      const mod = berthNo % 8;
      if (mod === 1 || mod === 4) return { type: 'Lower Berth', code: 'LB', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
      if (mod === 2 || mod === 5) return { type: 'Middle Berth', code: 'MB', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' };
      if (mod === 3 || mod === 6) return { type: 'Upper Berth', code: 'UB', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' };
      if (mod === 7) return { type: 'Side Lower', code: 'SL', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' };
      if (mod === 0) return { type: 'Side Upper', code: 'SU', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30' };
    } else if (coachClass === '2A') {
      const mod = berthNo % 6;
      if (mod === 1 || mod === 3) return { type: 'Lower Berth', code: 'LB', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
      if (mod === 2 || mod === 4) return { type: 'Upper Berth', code: 'UB', color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' };
      if (mod === 5) return { type: 'Side Lower', code: 'SL', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' };
      if (mod === 0) return { type: 'Side Upper', code: 'SU', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30' };
    } else if (coachClass === 'CC') {
      const mod = berthNo % 5;
      if (mod === 1 || mod === 0) return { type: 'Window Seat', code: 'W', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
      if (mod === 2 || mod === 4) return { type: 'Aisle Seat', code: 'A', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30' };
      return { type: 'Middle Seat', code: 'M', color: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/30' };
    }
    return { type: 'Standard', code: 'BERTH', color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200' };
  };

  const totalBerths = selectedCoachClass === '3A' ? 64 : selectedCoachClass === '2A' ? 46 : selectedCoachClass === 'CC' ? 78 : 72;
  const baysCount = Math.ceil(totalBerths / (selectedCoachClass === '2A' ? 6 : 8));

  const parsedSearch = parseInt(searchBerth, 10);
  const searchedInfo = !isNaN(parsedSearch) && parsedSearch >= 1 && parsedSearch <= totalBerths ? getBerthType(parsedSearch, selectedCoachClass) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white">
              <Train className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Coach Composition & Seat Map
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                Train #{trainNo} • {trainName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Section 1: Train Formation Sequence */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-mono">
                Standard Train Formation (Rake Order)
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                Engine &larr; Direction of Travel
              </span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-3 pt-1">
              {DEFAULT_COACH_FORMATION.map((coach, idx) => (
                <div
                  key={idx}
                  className={`shrink-0 flex flex-col items-center justify-center w-14 h-12 rounded-lg border text-center font-mono transition ${
                    coach.type === 'ENGINE'
                      ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold border-zinc-950 dark:border-white'
                      : coach.type === '3A' || coach.type === '2A' || coach.type === '1A'
                      ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 font-semibold'
                      : 'bg-zinc-50 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400'
                  }`}
                  title={`${coach.label}`}
                >
                  <span className="text-xs font-bold">{coach.code}</span>
                  <span className="text-[9px] uppercase tracking-tighter text-zinc-400">
                    {coach.type}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Interactive Berth Visualizer */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-mono block">
                  Interactive Berth Position Map
                </span>
                <span className="text-xs text-zinc-400">
                  Select coach class to preview compartment layout
                </span>
              </div>

              {/* Class Tabs */}
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                {(['3A', '2A', 'SL', 'CC'] as const).map(cls => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => setSelectedCoachClass(cls)}
                    className={`px-3 py-1 rounded text-xs font-mono font-bold transition ${
                      selectedCoachClass === cls
                        ? 'bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                    }`}
                  >
                    {cls}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Berth Finder */}
            <div className="mb-4 flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900/80 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <label className="text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-300 shrink-0">
                Find Berth #:
              </label>
              <input
                type="number"
                min="1"
                max={totalBerths}
                value={searchBerth}
                onChange={e => setSearchBerth(e.target.value)}
                placeholder={`1 - ${totalBerths}`}
                className="w-24 px-3 py-1 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs font-mono font-bold text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-zinc-900"
              />
              {searchedInfo && (
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${searchedInfo.color}`}>
                    {searchedInfo.code} • {searchedInfo.type}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    (Bay {Math.ceil(parsedSearch / (selectedCoachClass === '2A' ? 6 : 8))})
                  </span>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-2 mb-4 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                LB: Lower Berth
              </span>
              {(selectedCoachClass === '3A' || selectedCoachClass === 'SL') && (
                <span className="px-2 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">
                  MB: Middle Berth
                </span>
              )}
              <span className="px-2 py-0.5 rounded border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold">
                UB: Upper Berth
              </span>
              <span className="px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
                SL: Side Lower
              </span>
              <span className="px-2 py-0.5 rounded border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold">
                SU: Side Upper
              </span>
            </div>

            {/* Compartment Bay Grid */}
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {Array.from({ length: baysCount }).map((_, bayIdx) => {
                const bayNo = bayIdx + 1;
                const baySize = selectedCoachClass === '2A' ? 6 : 8;
                const startBerth = bayIdx * baySize + 1;
                const endBerth = Math.min(startBerth + baySize - 1, totalBerths);

                return (
                  <div
                    key={bayNo}
                    className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="shrink-0 font-mono">
                      <span className="text-xs font-bold text-zinc-900 dark:text-white">
                        Bay #{bayNo}
                      </span>
                      <span className="text-[10px] text-zinc-400 block">
                        Berths {startBerth} - {endBerth}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {Array.from({ length: endBerth - startBerth + 1 }).map((_, bOffset) => {
                        const bNum = startBerth + bOffset;
                        const bInfo = getBerthType(bNum, selectedCoachClass);
                        const isHighlighted = parsedSearch === bNum;

                        return (
                          <div
                            key={bNum}
                            className={`px-2 py-1 rounded-md text-xs font-mono flex items-center gap-1 border transition ${
                              isHighlighted
                                ? 'ring-2 ring-zinc-900 dark:ring-white font-bold scale-105'
                                : ''
                            } ${bInfo.color}`}
                          >
                            <span className="font-bold">{bNum}</span>
                            <span className="text-[10px] opacity-75">{bInfo.code}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-mono">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-zinc-400" />
            <span>Rake layouts follow Indian Railways LHB standard configurations.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold hover:bg-zinc-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
