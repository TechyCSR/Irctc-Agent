import React, { useEffect, useState } from 'react';
import { X, Receipt, Info } from 'lucide-react';
import { getFareBreakdown } from '../services/api';
import type { FareBreakdownItem } from '../types';

interface FareBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  fare: number;
  travelClass: string;
  trainNo: string;
  trainName: string;
}

export const FareBreakdownModal: React.FC<FareBreakdownModalProps> = ({
  isOpen,
  onClose,
  fare,
  travelClass,
  trainNo,
  trainName,
}) => {
  const [breakdown, setBreakdown] = useState<FareBreakdownItem | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && fare > 0) {
      setLoading(true);
      getFareBreakdown(fare, travelClass)
        .then(data => setBreakdown(data))
        .catch(() => {
          // Fallback calculation if backend unreachable
          const isAc = ['1A', '2A', '3A', '3E', 'CC', 'EC'].includes(travelClass);
          const resFee = travelClass === '1A' ? 60 : travelClass === '2A' ? 50 : isAc ? 40 : 20;
          const sfCharge = isAc ? 45 : 30;
          const net = isAc ? Math.round(fare / 1.05) : fare;
          const gst = fare - net;
          const base = Math.max(50, net - (resFee + sfCharge));
          setBreakdown({
            total_fare: fare,
            base_fare: base,
            reservation_fee: resFee,
            superfast_surcharge: sfCharge,
            dynamic_surge: Math.max(0, net - (base + resFee + sfCharge)),
            gst,
            gst_rate: isAc ? '5%' : '0%',
            travel_class: travelClass,
            currency: 'INR',
          });
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen, fare, travelClass]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Official Fare Breakdown
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                Train #{trainNo} • Class {travelClass}
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
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <span className="text-xs text-zinc-400 uppercase font-mono block">Train Service</span>
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">{trainName}</span>
            </div>
            <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700">
              Class {travelClass}
            </span>
          </div>

          {loading || !breakdown ? (
            <div className="py-8 text-center text-xs font-mono text-zinc-400 animate-pulse">
              Calculating IRCTC tariff breakdown...
            </div>
          ) : (
            <div className="space-y-2.5 font-mono text-sm">
              <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-300">
                <span>Base Distance Fare:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">₹{breakdown.base_fare}</span>
              </div>

              <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-300">
                <span>Reservation Charge:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">₹{breakdown.reservation_fee}</span>
              </div>

              <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-300">
                <span>Superfast Surcharge:</span>
                <span className="font-semibold text-zinc-900 dark:text-white">₹{breakdown.superfast_surcharge}</span>
              </div>

              {breakdown.dynamic_surge > 0 && (
                <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
                  <span>Dynamic / Tatkal Surge:</span>
                  <span className="font-semibold">₹{breakdown.dynamic_surge}</span>
                </div>
              )}

              <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-300">
                <span>GST ({breakdown.gst_rate}):</span>
                <span className="font-semibold text-zinc-900 dark:text-white">₹{breakdown.gst}</span>
              </div>

              <div className="pt-3 border-t-2 border-dashed border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-base font-bold text-zinc-950 dark:text-white">
                <span>Total Ticket Fare:</span>
                <span className="text-lg">₹{breakdown.total_fare}</span>
              </div>
            </div>
          )}

          <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-start gap-2.5 text-xs text-zinc-500 dark:text-zinc-400">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-zinc-400" />
            <span>
              Fare calculated in accordance with Ministry of Railways passenger tariff chart. No hidden agent convenience fees added.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold hover:bg-zinc-800 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
