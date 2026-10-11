import React, { useState } from 'react';
import {
  Clock,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import type { RouteItinerary } from '../types';

interface ItineraryCardProps {
  itinerary: RouteItinerary;
}

export const ItineraryCard: React.FC<ItineraryCardProps> = ({ itinerary }) => {
  const [copied, setCopied] = useState(false);

  const isConfirmed = itinerary.booking_confidence === 'CONFIRMED';
  const isRac = itinerary.booking_confidence === 'RAC';

  const rankBadgeBg =
    itinerary.rank === 1
      ? 'bg-amber-500 text-white shadow-xs shadow-amber-200'
      : itinerary.rank <= 3
      ? 'bg-indigo-600 text-white'
      : 'bg-slate-800 text-white';

  const leg1 = itinerary.legs[0];
  const leg2 = itinerary.legs.length > 1 ? itinerary.legs[1] : null;

  const handleCopy = () => {
    const text = `IRCTC Journey Plan (${itinerary.type === 'DIRECT' ? 'Direct' : 'via ' + itinerary.hub}):
Leg 1: ${leg1.train_no} ${leg1.train_name} (${leg1.from} ${leg1.departure} -> ${leg1.to} ${leg1.arrival})
${leg2 ? `Layover: ${itinerary.layover_str} at ${itinerary.hub}\nLeg 2: ${leg2.train_no} ${leg2.train_name} (${leg2.from} ${leg2.departure} -> ${leg2.to} ${leg2.arrival})\n` : ''}Total Time: ${itinerary.total_duration_str} | Combined Fare: ₹${itinerary.best_fare}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderSeatPill = (cls: string, status: string) => {
    let color = 'bg-slate-100 text-slate-700 border-slate-200';
    if (status.includes('AVAILABLE') && !status.includes('NOT AVAILABLE')) {
      color = 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold';
    } else if (status.includes('RAC')) {
      color = 'bg-blue-50 text-blue-700 border-blue-300 font-medium';
    } else if (status.includes('REGRET') || status.includes('NOT AVAILABLE')) {
      color = 'bg-rose-50 text-rose-500 border-rose-200 line-through';
    } else if (status.includes('WL')) {
      color = 'bg-amber-50 text-amber-700 border-amber-300';
    }
    return (
      <span
        key={cls}
        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border ${color}`}
      >
        <span className="font-semibold mr-1">{cls}:</span> {status}
      </span>
    );
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all">
      {/* Top Banner Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center px-3 py-1 rounded-lg text-xs font-extrabold uppercase tracking-wide ${rankBadgeBg}`}>
            Recommendation #{itinerary.rank}
          </span>

          {isConfirmed && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600 stroke-[2.5]" />
              100% Confirmed Seats
            </span>
          )}

          {isRac && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
              RAC Boarding Guaranteed
            </span>
          )}

          {itinerary.is_detour && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <AlertTriangle className="w-3 h-3 mr-1 text-amber-600" />
              Detour Route ({itinerary.hub})
            </span>
          )}

          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
            {itinerary.corridor}
          </span>
        </div>

        {/* Total Journey & Combined Fare */}
        <div className="flex items-baseline space-x-5 self-start sm:self-auto">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
              Total Duration
            </span>
            <span className="text-sm font-extrabold text-slate-900">
              {itinerary.total_duration_str}
            </span>
          </div>

          {itinerary.best_fare > 0 && (
            <div className="text-right">
              <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
                Combined Fare
              </span>
              <span className="text-base font-extrabold text-indigo-600">
                ₹{itinerary.best_fare}{' '}
                <span className="text-xs font-medium text-slate-500">
                  ({itinerary.best_fare_class})
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Visual Train Journey Steps */}
      <div className="py-4 space-y-3.5">
        {/* Leg 1 Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
            <div className="flex items-center space-x-2">
              <span className="w-5 h-5 rounded-md bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center">
                1
              </span>
              <span className="text-sm font-bold text-slate-900">
                {leg1.train_no} {leg1.train_name}
              </span>
            </div>
            <span className="text-xs text-slate-500">
              Duration: <strong className="text-slate-700">{leg1.duration}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block font-medium">Boarding Station</span>
              <span className="font-bold text-slate-800 text-sm">{leg1.from}</span>
              <span className="text-indigo-600 font-semibold block">{leg1.departure}</span>
              {leg1.alt_from && leg1.alt_from.length > 0 && (
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Also calls at: {leg1.alt_from.join(', ')}
                </span>
              )}
            </div>

            <div>
              <span className="text-slate-400 block font-medium">
                {leg2 ? 'Transfer Station' : 'Destination'}
              </span>
              <span className="font-bold text-slate-800 text-sm">{leg1.to}</span>
              <span className="text-indigo-600 font-semibold block">{leg1.arrival}</span>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <span className="text-slate-400 block font-medium mb-1">Live Seat Status</span>
              <div className="flex flex-wrap gap-1">
                {Object.entries(leg1.seats).map(([cls, st]) => renderSeatPill(cls, st))}
              </div>
            </div>
          </div>
        </div>

        {/* Layover Connector (if 1-transfer) */}
        {leg2 && (
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-700 shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>
                <strong>{itinerary.layover_str}</strong> transfer layover at{' '}
                <strong className="text-slate-900">{itinerary.hub}</strong>
              </span>
              <span className="text-slate-400">&bull;</span>
              <span className="text-indigo-600 font-semibold">{itinerary.transfer_type}</span>
            </div>
          </div>
        )}

        {/* Leg 2 Card */}
        {leg2 && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center space-x-2">
                <span className="w-5 h-5 rounded-md bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center">
                  2
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {leg2.train_no} {leg2.train_name}
                </span>
              </div>
              <span className="text-xs text-slate-500">
                Duration: <strong className="text-slate-700">{leg2.duration}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Departure Hub</span>
                <span className="font-bold text-slate-800 text-sm">{leg2.from}</span>
                <span className="text-indigo-600 font-semibold block">{leg2.departure}</span>
              </div>

              <div>
                <span className="text-slate-400 block font-medium">Final Destination</span>
                <span className="font-bold text-slate-800 text-sm">{leg2.to}</span>
                <span className="text-indigo-600 font-semibold block">{leg2.arrival}</span>
                {leg2.alt_to && leg2.alt_to.length > 0 && (
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Nearby terminals: {leg2.alt_to.join(', ')}
                  </span>
                )}
              </div>

              <div className="col-span-2 sm:col-span-1">
                <span className="text-slate-400 block font-medium mb-1">Live Seat Status</span>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(leg2.seats).map(([cls, st]) => renderSeatPill(cls, st))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Card Footer: Combined Fares & Action Buttons */}
      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-slate-400 mr-1 uppercase tracking-wider text-[10px]">
            Combined Fares:
          </span>
          {itinerary.fares_by_class && Object.keys(itinerary.fares_by_class).length > 0 ? (
            Object.entries(itinerary.fares_by_class).map(([cls, fare]) => (
              <span
                key={cls}
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200"
              >
                {cls}: ₹{fare}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400">Available at IRCTC booking</span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Plan'}</span>
          </button>

          <a
            href="https://www.irctc.co.in/nget/train-search"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow-2xs"
          >
            <span>Book on IRCTC</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
