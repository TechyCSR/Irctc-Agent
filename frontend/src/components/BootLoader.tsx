import React, { useState, useEffect } from 'react';
import { Train } from 'lucide-react';

interface BootLoaderProps {
  onComplete: () => void;
}

export const BootLoader: React.FC<BootLoaderProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [stepText, setStepText] = useState('Initializing IRCTC AGENT...');
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const steps = [
      { progress: 28, text: 'Indexing 8,566 railway stations...' },
      { progress: 65, text: 'Calibrating corridor detour geometry...' },
      { progress: 92, text: 'Connecting live seat feeds...' },
      { progress: 100, text: 'System ready.' },
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setProgress(steps[currentStep].progress);
        setStepText(steps[currentStep].text);
        currentStep++;
      } else {
        clearInterval(interval);
        setIsFading(true);
        setTimeout(() => {
          onComplete();
        }, 300);
      }
    }, 180);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white transition-opacity duration-300 ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="max-w-xs w-full px-6 flex flex-col items-center space-y-6">
        {/* Minimal Glyph */}
        <div className="relative">
          <div className="w-12 h-12 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center shadow-lg">
            <Train className="w-6 h-6 animate-pulse" />
          </div>
          <div className="absolute -inset-1 rounded-xl border border-zinc-300 dark:border-zinc-700 -z-10 animate-ping opacity-30" />
        </div>

        {/* Brand & Subtitle */}
        <div className="text-center space-y-1">
          <h1 className="font-mono font-black text-lg tracking-widest uppercase">
            IRCTC AGENT
          </h1>
          <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            Smart Confirmed Route Engine
          </p>
        </div>

        {/* Minimal Progress Bar */}
        <div className="w-full space-y-2">
          <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-800">
            <div
              className="h-full bg-zinc-950 dark:bg-white transition-all duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
            <span>{stepText}</span>
            <span>{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};
