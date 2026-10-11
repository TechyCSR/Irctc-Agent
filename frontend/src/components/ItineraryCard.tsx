import React, { useState } from 'react';
import {
  Clock,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';
import type { RouteItinerary } from '../types';
import { useToast } from './Toast';

interface ItineraryCardProps {
  itinerary: RouteItinerary;
}

export const ItineraryCard: React.FC<ItineraryCardProps> = ({ itinerary }) => {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const isConfirmed = itinerary.booking_confidence === 'CONFIRMED';
  const isRac = itinerary.booking_confidence === 'RAC';

  const leg1 = itinerary.legs[0];
  const leg2 = itinerary.legs.length > 1 ? itinerary.legs[1] : null;

  const handleCopy = () => {
    const text = `IRCTC AGENT — Route Option #${itinerary.rank} (${itinerary.type === 'DIRECT' ? 'Direct' : 'via ' + itinerary.hub}):
Leg 1: ${leg1.train_no} ${leg1.train_name} (${leg1.from} ${leg1.departure} → ${leg1.to} ${leg1.arrival})
${leg2 ? `Transfer: ${itinerary.layover_str} layover at ${itinerary.hub} (${itinerary.transfer_type})\nLeg 2: ${leg2.train_no} ${leg2.train_name} (${leg2.from} ${leg2.departure} → ${leg2.to} ${leg2.arrival})\n` : ''}Total Travel: ${itinerary.total_duration_str} | Combined Fare: ₹${itinerary.best_fare} (${itinerary.best_fare_class})
Status: ${itinerary.booking_confidence}`;
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast(`Copied Option #${itinerary.rank} details to clipboard`, 'success');
    setTimeout(() => setCopied(false), 2200);
  };

  const renderSeatPill = (cls: string, status: string) => {
    const isAvail = status.includes('AVAILABLE') && !status.includes('NOT AVAILABLE');
    const isRacSeat = status.includes('RAC');
    const isWlOrRegret = status.includes('REGRET') || status.includes('WL') || status.includes('NOT AVAILABLE');

    let style = 'border-zinc-200 text-zinc-500 bg-zinc-50';
    if (isAvail) {
      style = 'border-zinc-900 bg-zinc-950 text-white font-bold shadow-2xs';
    } else if (isRacSeat) {
      style = 'border-zinc-800 text-zinc-900 bg-zinc-100 font-semibold';
    } else if (isWlOrRegret) {
      style = 'border-zinc-200 text-zinc-400 bg-zinc-50/50 line-through';
    }

    return (
      <span
        key={cls}
        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono border ${style}`}
      >
        <span className="font-bold mr-1">{cls}:</span> {status}
      </span>
    );
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs hover:border-zinc-400 transition-all">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100">
        <div className="flex flex-wrap items-center gap-2">
          {/* Recommendation Rank */}
          <span className="inline-flex items-center px-2.5 py-1 rounded bg-zinc-950 text-white font-mono text-xs font-bold tracking-tight">
            OPTION #{itinerary.rank}
          </span>

          {/* Direct vs 1-Transfer */}
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono uppercase bg-zinc-100 text-zinc-800 border border-zinc-200">
            {itinerary.type === 'DIRECT' ? 'Direct Train' : `1-Transfer • Via ${itinerary.hub}`}
          </span>

          {/* Booking Confidence */}
          {isConfirmed && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-zinc-900 text-white">
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-zinc-300" />
              CONFIRMED SEATS
            </span>
          )}

          {isRac && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border border-zinc-900 text-zinc-900 bg-zinc-100">
              RAC GUARANTEED
            </span>
          )}

          {itinerary.is_detour && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border border-zinc-300 text-zinc-600">
              <AlertCircle className="w-3 h-3 mr-1 text-zinc-500" />
              Detour corridor ({itinerary.detour_ratio.toFixed(2)}x)
            </span>
          )}
        </div>

        {/* Total Time & Fare */}
        <div className="flex items-baseline gap-6 self-start sm:self-auto">
          <div>
            <span className="text-[10px] font-mono uppercase text-zinc-400 block tracking-wider">
              Total Travel
            </span>
            <span className="text-sm font-mono font-bold text-zinc-900">
              {itinerary.total_duration_str}
            </span>
          </div>

          {itinerary.best_fare > 0 && (
            <div className="text-right">
              <span className="text-[10px] font-mono uppercase text-zinc-400 block tracking-wider">
                Total Fare
              </span>
              <span className="text-base font-mono font-bold text-zinc-950">
                ₹{itinerary.best_fare}{' '}
                <span className="text-xs font-normal text-zinc-500">
                  ({itinerary.best_fare_class})
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Train Leg Itinerary */}
      <div className="py-4 space-y-3">
        {/* Leg 1 */}
        <div className="bg-zinc-50/70 border border-zinc-200 rounded-lg p-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded bg-zinc-900 text-white font-mono text-[10px] font-bold flex items-center justify-center">
                1
              </span>
              <span className="text-xs font-mono font-bold text-zinc-950">
                #{leg1.train_no}
              </span>
              <span className="text-sm font-semibold text-zinc-900">
                {leg1.train_name}
              </span>
            </div>
            <span className="text-xs font-mono text-zinc-500">
              Duration: <strong className="text-zinc-800">{leg1.duration}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-mono uppercase text-zinc-400 block">Boarding</span>
              <span className="font-mono font-bold text-zinc-900 text-sm">{leg1.from}</span>
              <span className="font-mono text-zinc-700 font-semibold block">{leg1.departure}</span>
              {leg1.alt_from && leg1.alt_from.length > 0 && (
                <span className="text-[10px] text-zinc-400 block mt-0.5">
                  Cluster stations: {leg1.alt_from.join(', ')}
                </span>
              )}
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase text-zinc-400 block">
                {leg2 ? 'Transfer Junction' : 'Final Destination'}
              </span>
              <span className="font-mono font-bold text-zinc-900 text-sm">{leg1.to}</span>
              <span className="font-mono text-zinc-700 font-semibold block">{leg1.arrival}</span>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <span className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                Seat Availability
              </span>
              <div className="flex flex-wrap gap-1">
                {Object.entries(leg1.seats).map(([cls, st]) => renderSeatPill(cls, st))}
              </div>
            </div>
          </div>
        </div>

        {/* Layover connector if 1-transfer */}
        {leg2 && (
          <div className="flex items-center justify-center my-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-zinc-300 text-xs font-mono text-zinc-800 shadow-2xs">
              <Clock className="w-3.5 h-3.5 text-zinc-500" />
              <span>
                <strong className="font-bold">{itinerary.layover_str}</strong> layover at{' '}
                <strong className="font-bold">{itinerary.hub}</strong>
              </span>
              <span className="text-zinc-300">&bull;</span>
              <span className="text-zinc-600">{itinerary.transfer_type}</span>
            </div>
          </div>
        )}

        {/* Leg 2 */}
        {leg2 && (
          <div className="bg-zinc-50/70 border border-zinc-200 rounded-lg p-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-zinc-900 text-white font-mono text-[10px] font-bold flex items-center justify-center">
                  2
                </span>
                <span className="text-xs font-mono font-bold text-zinc-950">
                  #{leg2.train_no}
                </span>
                <span className="text-sm font-semibold text-zinc-900">
                  {leg2.train_name}
                </span>
              </div>
              <span className="text-xs font-mono text-zinc-500">
                Duration: <strong className="text-zinc-800">{leg2.duration}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-mono uppercase text-zinc-400 block">Departing Hub</span>
                <span className="font-mono font-bold text-zinc-900 text-sm">{leg2.from}</span>
                <span className="font-mono text-zinc-700 font-semibold block">{leg2.departure}</span>
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-zinc-400 block">Final Destination</span>
                <span className="font-mono font-bold text-zinc-900 text-sm">{leg2.to}</span>
                <span className="font-mono text-zinc-700 font-semibold block">{leg2.arrival}</span>
                {leg2.alt_to && leg2.alt_to.length > 0 && (
                  <span className="text-[10px] text-zinc-400 block mt-0.5">
                    Nearby terminals: {leg2.alt_to.join(', ')}
                  </span>
                )}
              </div>

              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] font-mono uppercase text-zinc-400 block mb-1">
                  Seat Availability
                </span>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(leg2.seats).map(([cls, st]) => renderSeatPill(cls, st))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer: Class fares breakdown & CTAs */}
      <div className="pt-3 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-mono uppercase text-zinc-400 mr-1 font-bold">
            Fares:
          </span>
          {itinerary.fares_by_class && Object.keys(itinerary.fares_by_class).length > 0 ? (
            Object.entries(itinerary.fares_by_class).map(([cls, fare]) => (
              <span
                key={cls}
                className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-100 text-zinc-900 border border-zinc-200"
              >
                {cls}: ₹{fare}
              </span>
            ))
          ) : (
            <span className="text-xs font-mono text-zinc-400">Calculated upon booking</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 bg-white hover:bg-zinc-100 text-zinc-800 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-zinc-900" /> : <Copy className="w-3.5 h-3.5 text-zinc-600" />}
            <span>{copied ? 'Copied!' : 'Copy Plan'}</span>
          </button>

          <a
            href="https://www.irctc.co.in/nget/train-search"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-zinc-950 text-white hover:bg-zinc-800 transition shadow-xs"
          >
            <span>Book on IRCTC</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
