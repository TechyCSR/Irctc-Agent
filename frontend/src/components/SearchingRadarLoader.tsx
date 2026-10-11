import React, { useState, useEffect } from 'react';
import { Train, Radio, Compass, ShieldCheck, Zap, ArrowRight } from 'lucide-react';

interface SearchingRadarLoaderProps {
  originCode?: string;
  originName?: string;
  destCode?: string;
  destName?: string;
  statusText?: string;
}

const SEARCH_PHASES = [
  {
    icon: Compass,
    title: 'Network Topology Scan',
    subtitle: 'Scanning 8,566 Indian Railways stations and junction graphs...',
  },
  {
    icon: Train,
    title: 'Live Quota Inspection',
    subtitle: 'Querying direct trains across General, Tatkal, Ladies & Lower Berth quotas...',
  },
  {
    icon: Zap,
    title: 'Same-Train Split Detection',
    subtitle: 'Searching intermediate station splits on exact same coaches for waitlisted routes...',
  },
  {
    icon: Radio,
    title: '1-Transfer Corridor Geometry',
    subtitle: 'Evaluating junction hubs, cross-terminal taxi buffers & layover safety...',
  },
  {
    icon: ShieldCheck,
    title: 'Finalizing Confirmed Itineraries',
    subtitle: 'Computing confirmation probability, lowest fares & IRCTC direct booking handoffs...',
  },
];

export const SearchingRadarLoader: React.FC<SearchingRadarLoaderProps> = ({
  originCode = 'FROM',
  originName = '',
  destCode = 'TO',
  destName = '',
  statusText,
}) => {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % SEARCH_PHASES.length);
    }, 1800);
    return () => clearInterval(timer);
  }, []);

  const currentPhase = SEARCH_PHASES[phaseIndex];
  const CurrentIcon = currentPhase.icon;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Glassmorphic Radar Search Box */}
      <div className="glass-card bg-white/85 dark:bg-zinc-900/85 border border-zinc-200/90 dark:border-zinc-800/90 rounded-2xl p-6 sm:p-8 shadow-xl dark:shadow-2xl relative overflow-hidden">
        {/* Subtle Background Radial Ambient Glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-zinc-200/40 dark:bg-zinc-800/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-zinc-200/40 dark:bg-zinc-800/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 sm:gap-8">
          {/* Circular Radar Scanner */}
          <div className="relative w-32 h-32 sm:w-36 sm:h-36 shrink-0 flex items-center justify-center">
            {/* Outer Ring */}
            <div className="absolute inset-0 rounded-full border border-zinc-300/80 dark:border-zinc-700/80" />
            {/* Middle Ring */}
            <div className="absolute inset-4 rounded-full border border-zinc-200 dark:border-zinc-800" />
            {/* Inner Ring */}
            <div className="absolute inset-8 rounded-full border border-zinc-200/60 dark:border-zinc-800/60" />

            {/* Radar Crosshairs */}
            <div className="absolute inset-x-0 top-1/2 h-px bg-zinc-200 dark:bg-zinc-800" />
            <div className="absolute inset-y-0 left-1/2 w-px bg-zinc-200 dark:bg-zinc-800" />

            {/* Rotating Radar Sweep Cone */}
            <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none animate-radar-sweep">
              <div
                className="w-1/2 h-1/2 origin-bottom-right"
                style={{
                  background: 'conic-gradient(from 180deg at 100% 100%, transparent 60deg, rgba(24, 24, 27, 0.18) 180deg)',
                }}
              />
            </div>

            {/* Pulsing Corridor Nodes on Radar */}
            <div className="absolute top-6 left-8 w-2 h-2 rounded-full bg-zinc-900 dark:bg-white animate-ping opacity-75" />
            <div className="absolute top-6 left-8 w-2 h-2 rounded-full bg-zinc-950 dark:bg-white" />

            <div className="absolute bottom-8 right-10 w-2 h-2 rounded-full bg-zinc-700 dark:bg-zinc-300 animate-ping opacity-60 delay-300" />
            <div className="absolute bottom-8 right-10 w-2 h-2 rounded-full bg-zinc-900 dark:bg-zinc-200" />

            <div className="absolute top-10 right-6 w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-pulse" />

            {/* Center Core Hub */}
            <div className="relative z-10 w-8 h-8 rounded-full bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shadow-md">
              <Train className="w-4 h-4 animate-pulse" />
            </div>
          </div>

          {/* Scanner Details & Active Phase */}
          <div className="flex-1 text-center md:text-left space-y-3.5 w-full">
            {/* Corridor Breadcrumb with Animated Gliding Train */}
            <div className="inline-flex flex-wrap items-center justify-center md:justify-start gap-2 px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 font-mono text-xs">
              <span className="font-bold text-zinc-900 dark:text-white">
                {originCode} {originName ? `(${originName})` : ''}
              </span>
              <div className="flex items-center gap-1 text-zinc-400 dark:text-zinc-500">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
                <Train className="w-3.5 h-3.5 animate-train-glide text-zinc-800 dark:text-zinc-200" />
                <ArrowRight className="w-3 h-3 text-zinc-400" />
              </div>
              <span className="font-bold text-zinc-900 dark:text-white">
                {destCode} {destName ? `(${destName})` : ''}
              </span>
            </div>

            {/* Live Progress Stage Announcement */}
            <div>
              <div className="flex items-center justify-center md:justify-start gap-2 text-sm font-mono font-bold text-zinc-950 dark:text-white">
                <span className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                  <CurrentIcon className="w-3.5 h-3.5 animate-pulse" />
                </span>
                <span>{currentPhase.title}</span>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono mt-1 leading-relaxed">
                {statusText || currentPhase.subtitle}
              </p>
            </div>

            {/* Shimmering Laser Progress Bar */}
            <div className="relative h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden border border-zinc-200/80 dark:border-zinc-700/80">
              <div className="h-full w-2/5 bg-zinc-950 dark:bg-white rounded-full animate-laser-sweep" />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 dark:text-zinc-500 pt-0.5">
              <span>Pathfinder Engine v2.0</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Scanning Corridors...
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Glassmorphic Placeholder Route Skeletons */}
      <div className="space-y-3.5">
        {[1, 2].map((idx) => (
          <div
            key={idx}
            className="glass-card bg-white/60 dark:bg-zinc-900/60 border border-zinc-200/70 dark:border-zinc-800/70 rounded-xl p-5 space-y-4 animate-pulse"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800/60">
              <div className="flex items-center gap-2">
                <div className="h-5 w-24 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-5 w-32 bg-zinc-100 dark:bg-zinc-800/60 rounded" />
                <div className="h-5 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-5 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-5 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
              </div>
            </div>

            <div className="p-3.5 rounded-lg bg-zinc-50/70 dark:bg-zinc-950/40 border border-zinc-100 dark:border-zinc-800/40 space-y-2.5">
              <div className="flex justify-between items-center">
                <div className="h-4 w-44 bg-zinc-200 dark:bg-zinc-800 rounded" />
                <div className="h-4 w-28 bg-zinc-100 dark:bg-zinc-800/60 rounded" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                <div className="h-8 bg-zinc-200/80 dark:bg-zinc-800/80 rounded" />
                <div className="h-8 bg-zinc-200/80 dark:bg-zinc-800/80 rounded" />
                <div className="h-8 bg-zinc-200/80 dark:bg-zinc-800/80 rounded col-span-2 sm:col-span-1" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
