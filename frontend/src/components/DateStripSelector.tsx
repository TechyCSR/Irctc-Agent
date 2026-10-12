import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { getMultiDateAvailability } from '../services/api';
import type { MultiDateItem } from '../types';

interface DateStripSelectorProps {
  fromCode: string;
  toCode: string;
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (isoDate: string) => void;
  quota?: string;
}

export const DateStripSelector: React.FC<DateStripSelectorProps> = ({
  fromCode,
  toCode,
  selectedDate,
  onSelectDate,
  quota = 'GN',
}) => {
  const [dateItems, setDateItems] = useState<MultiDateItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!fromCode || !toCode || !selectedDate) return;

    // Convert to DD-MM-YYYY safely
    const clean = selectedDate.trim().replace(/\//g, '-');
    const parts = clean.split('-');
    let formattedStart = clean;
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        formattedStart = `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
      } else if (parts[2].length === 4) {
        formattedStart = `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
      }
    }

    setIsLoading(true);
    getMultiDateAvailability(fromCode, toCode, formattedStart, 5, quota)
      .then((res) => {
        setDateItems(res.dates || []);
      })
      .catch((err) => {
        console.error('Failed to load multi-date strip:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [fromCode, toCode, selectedDate, quota]);

  if (!fromCode || !toCode) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-3 shadow-xs">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-[10px] font-mono uppercase text-zinc-400 dark:text-zinc-500 font-bold flex items-center gap-1.5">
          <Calendar className="w-3 h-3 text-zinc-950 dark:text-zinc-100" />
          5-Day Availability Matrix (Direct & Corridor Trains)
        </span>
        {isLoading && (
          <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-zinc-950 dark:bg-white animate-ping" />
            Updating dates...
          </span>
        )}
      </div>

      <div className="flex overflow-x-auto no-scrollbar sm:grid sm:grid-cols-5 gap-2 pb-0.5">
        {dateItems.map((item) => {
          const isSelected = item.iso_date === selectedDate;
          const hasConfirmed = item.confirmed_trains > 0;
          const hasRac = item.rac_trains > 0;

          return (
            <button
              key={item.iso_date}
              type="button"
              onClick={() => onSelectDate(item.iso_date)}
              className={`min-w-[105px] flex-1 sm:min-w-0 p-2.5 rounded-lg border text-left transition-all relative cursor-pointer shrink-0 ${
                isSelected
                  ? 'border-zinc-950 dark:border-white bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-xs'
                  : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 hover:bg-zinc-100/70 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span
                  className={`text-[11px] font-mono font-bold uppercase ${
                    isSelected ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  {item.day_name}
                </span>
                <span className="text-xs font-mono font-bold">
                  {item.formatted_display}
                </span>
              </div>

              <div className="mt-1.5">
                {hasConfirmed ? (
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      isSelected
                        ? 'bg-white dark:bg-zinc-950 text-zinc-950 dark:text-white'
                        : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                    }`}
                  >
                    ✓ {item.confirmed_trains} Confirmed
                  </span>
                ) : hasRac ? (
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                      isSelected
                        ? 'border border-zinc-400 text-white dark:text-zinc-950'
                        : 'border border-zinc-400 text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    RAC Boarding
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                    WL / Alternate
                  </span>
                )}
              </div>

              {item.lowest_fare > 0 && (
                <div
                  className={`text-[10px] font-mono mt-1 ${
                    isSelected ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  From ₹{item.lowest_fare}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
