import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Volume2,
  Maximize2,
  Minimize2,
  RotateCcw,
  Compass,
} from 'lucide-react';

interface InteractiveTrainCanvasProps {
  className?: string;
  isDark?: boolean;
}

/**
 * Procedural Web Audio 3-Chime Steam Train Whistle
 * Generates an authentic harmonic steam whistle chord (D5 / F#5 / A5)
 */
const playAuthenticSteamWhistle = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Harmonious 3-chime steam whistle chord frequencies
    const freqs = [587.33, 739.99, 880.0];

    freqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      // Acoustic steam chamber low-pass filtering
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, now);

      // Natural acoustic swell and decay
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.12);
      gain.gain.setValueAtTime(0.09, now + 0.85);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.75);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.8);
    });
  } catch (err) {
    console.error('Audio playback error:', err);
  }
};

export const InteractiveTrainCanvas: React.FC<InteractiveTrainCanvasProps> = ({
  className = '',
  isDark = false, // Default light/white mode
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Model UID for the requested high-fidelity Flying Scotsman Steam Train
  const modelUid = '0d1438c93740499eb61f0f8c045a7346';
  const embedUrl = `https://sketchfab.com/models/${modelUid}/embed?autostart=1&preload=1&ui_infos=0&ui_watermark=0&ui_hint=0&ui_theme=${
    isDark ? 'dark' : 'white'
  }&transparent=1`;

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  const resetModelView = () => {
    setIsLoading(true);
    setReloadKey((k) => k + 1);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-2xl overflow-hidden border transition-all duration-300 shadow-xl ${
        isDark
          ? 'border-zinc-800 bg-zinc-950 text-white'
          : 'border-zinc-200/90 bg-gradient-to-b from-slate-50 via-white to-slate-50 text-zinc-900'
      } ${isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen w-screen' : 'h-[440px] sm:h-[480px]'} ${className}`}
    >
      {/* 3D Model Interactive Iframe */}
      <iframe
        key={reloadKey}
        title="Flying Scotsman Steam Train 3D Interactive Model"
        src={embedUrl}
        className={`w-full h-full border-0 transition-opacity duration-700 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        allow="autoplay; fullscreen; xr-spatial-tracking"
        allowFullScreen={true}
        onLoad={() => setIsLoading(false)}
      />

      {/* Loading Skeleton / Radar Animation while 3D Model Inits */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md pointer-events-none z-10 animate-fade-in">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-2 border-zinc-200 dark:border-zinc-800 border-t-zinc-900 dark:border-t-white animate-spin" />
            <Compass className="w-6 h-6 text-zinc-700 dark:text-zinc-300 absolute" />
          </div>
          <div className="text-center space-y-1">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-900 dark:text-white">
              Loading 3D Locomotive Model...
            </div>
            <div className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
              Initializing PBR shaders, textures & 3D orbital mesh
            </div>
          </div>
        </div>
      )}

      {/* Top Floating Control Bar */}
      <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between gap-2.5 pointer-events-none z-20">
        {/* Model Identifier & Live Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl glass-card bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/90 dark:border-zinc-800/90 shadow-md backdrop-blur-md pointer-events-auto">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="font-mono text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-wider">
            LOCOMOTIVE EXPRESS (3D)
          </span>
          <span className="hidden sm:inline text-zinc-300 dark:text-zinc-700">&bull;</span>
          <span className="hidden sm:inline text-[11px] font-mono text-zinc-500 dark:text-zinc-400 font-semibold">
            INTERACTIVE ORBIT
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Steam Whistle Sound Effect */}
          <button
            type="button"
            onClick={playAuthenticSteamWhistle}
            className="px-3 py-1.5 rounded-xl glass-card bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95"
            title="Sound Authentic Steam Whistle"
          >
            <Volume2 className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Whistle</span>
          </button>

          {/* Reset View */}
          <button
            type="button"
            onClick={resetModelView}
            className="p-2 rounded-xl glass-card bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white shadow-sm transition active:scale-95"
            title="Reset 3D View"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-xl glass-card bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white shadow-sm transition active:scale-95"
            title={isFullscreen ? 'Exit Fullscreen' : 'View Fullscreen 3D'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Bottom Floating Information & Interaction Tips Bar */}
      <div className="absolute bottom-3.5 left-3.5 right-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl glass-card bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/90 dark:border-zinc-800/90 shadow-lg backdrop-blur-md pointer-events-none z-20">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="p-1.5 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
          <div>
            <div className="font-bold text-zinc-950 dark:text-white">
              Railway Network Ready for Dispatch
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Select origin and destination stations above to find confirmed berths & corridor routes.
            </div>
          </div>
        </div>

        <div className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 sm:text-right shrink-0">
          Left Click + Drag: Orbit &bull; Scroll: Zoom &bull; Right Click: Pan
        </div>
      </div>
    </div>
  );
};
