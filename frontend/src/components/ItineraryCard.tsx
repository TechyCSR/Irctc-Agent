import React, { useState } from 'react';
import {
  Clock,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  MapPin,
  Car,
  Zap,
  Target,
  LayoutGrid,
  Bell,
  Share2
} from 'lucide-react';
import type { RouteItinerary } from '../types';
import { useToast } from './Toast';

interface ItineraryCardProps {
  itinerary: RouteItinerary;
  fromName?: string;
  toName?: string;
  doj?: string;
  onOpenSchedule?: (trainNo: string, trainName: string, boarding: string, alighting: string) => void;
  onOpenCoachLayout?: (trainNo: string, trainName: string) => void;
  onOpenFareBreakdown?: (fare: number, travelClass: string, trainNo: string, trainName: string) => void;
  onOpenWatchdog?: (trainNo: string, trainName: string, fromStn: string, toStn: string, travelClass: string) => void;
  onOpenExportShare?: (itinerary: RouteItinerary) => void;
}

export const ItineraryCard: React.FC<ItineraryCardProps> = ({
  itinerary,
  fromName = '',
  toName = '',
  doj = '',
  onOpenSchedule,
  onOpenCoachLayout,
  onOpenFareBreakdown,
  onOpenWatchdog,
  onOpenExportShare,
}) => {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const isConfirmed = itinerary.booking_confidence === 'CONFIRMED';
  const isRac = itinerary.booking_confidence === 'RAC';

  const leg1 = itinerary.legs[0];
  const leg2 = itinerary.legs.length > 1 ? itinerary.legs[1] : null;

  const isSplit = itinerary.type === 'SAME_TRAIN_SPLIT';
  const isPointBeyond = itinerary.type === 'POINT_BEYOND';

  const handleCopy = () => {
    const routeTitle = fromName && toName ? `${fromName} → ${toName} (${doj})` : `${itinerary.origin} → ${itinerary.destination}`;
    const text = `IRCTC AGENT — Route Option #${itinerary.rank} [${routeTitle}]:
Leg 1: ${leg1.train_no} ${leg1.train_name} (${leg1.from} ${leg1.departure} → ${leg1.to} ${leg1.arrival})
${leg2 ? `Transfer: ${itinerary.layover_str} layover at ${itinerary.hub} (${itinerary.transfer_type})${itinerary.inter_station_transfer ? ` [Inter-station: ${leg1.to} -> ${leg2.from}, ~${itinerary.hub_distance_km}km, ~${itinerary.recommended_cab_mins}m cab]` : ''}\nLeg 2: ${leg2.train_no} ${leg2.train_name} (${leg2.from} ${leg2.departure} → ${leg2.to} ${leg2.arrival})\n` : ''}Total Travel: ${itinerary.total_duration_str} | Combined Fare: ₹${itinerary.best_fare} (${itinerary.best_fare_class})
Status: ${itinerary.booking_confidence} (${itinerary.confirmation_probability || 95}% probability)`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast(`Copied Option #${itinerary.rank} details to clipboard`, 'success');
    setTimeout(() => setCopied(false), 2200);
  };

  const renderSeatPill = (cls: string, status: string) => {
    const isAvail = status.includes('AVAILABLE') && !status.includes('NOT AVAILABLE');
    const isRacSeat = status.includes('RAC');
    const isWlOrRegret = status.includes('REGRET') || status.includes('WL') || status.includes('NOT AVAILABLE');

    let style = 'border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900';
    if (isAvail) {
      style = 'border-zinc-900 dark:border-white bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold shadow-2xs';
    } else if (isRacSeat) {
      style = 'border-zinc-800 dark:border-zinc-300 text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 font-semibold';
    } else if (isWlOrRegret) {
      style = 'border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/40 line-through';
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

  const irctcBookingUrl = itinerary.irctc_link || `https://www.irctc.co.in/nget/train-search`;

  return (
    <div className="itinerary-card bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs hover:border-zinc-400 dark:hover:border-zinc-600 transition-all">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Recommendation Rank */}
          <span className="inline-flex items-center px-2.5 py-1 rounded bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-mono text-xs font-bold tracking-tight">
            OPTION #{itinerary.rank}
          </span>

          {/* Type Badge */}
          {isSplit ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-bold">
              <Zap className="w-3 h-3" />
              Same Train Split
            </span>
          ) : isPointBeyond ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono uppercase bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-bold">
              <Target className="w-3 h-3" />
              Origin Quota Hack
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700">
              {itinerary.type === 'DIRECT' ? 'Direct Train' : `1-Transfer • Via ${itinerary.hub}`}
            </span>
          )}

          {/* Booking Confidence */}
          {isConfirmed && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
              <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-400" />
              CONFIRMED SEATS
            </span>
          )}

          {isRac && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border border-zinc-900 dark:border-zinc-300 text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800">
              RAC GUARANTEED
            </span>
          )}

          {itinerary.confirmation_probability && itinerary.confirmation_probability < 100 && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border border-zinc-800 dark:border-zinc-700 text-zinc-800 dark:text-zinc-300">
              {itinerary.confirmation_probability}% Probability
            </span>
          )}
        </div>

        {/* Total Duration & Fare */}
        <div className="flex items-center gap-4 text-right">
          <div>
            <span className="text-[10px] font-mono uppercase text-zinc-400 block">Total Travel</span>
            <span className="text-sm font-mono font-bold text-zinc-900 dark:text-white flex items-center justify-end gap-1">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              {itinerary.total_duration_str}
            </span>
          </div>

          <div className="pl-4 border-l border-zinc-200 dark:border-zinc-800">
            <span className="text-[10px] font-mono uppercase text-zinc-400 block">Starting From</span>
            <span className="text-base font-mono font-black text-zinc-950 dark:text-white">
              {itinerary.best_fare > 0 ? `₹${itinerary.best_fare}` : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* Lifehack Tip Alert Box */}
      {itinerary.lifehack_tip && (
        <div className="my-3 p-3 bg-zinc-50 dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-start gap-2.5 text-xs text-zinc-800 dark:text-zinc-200">
          <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <span className="font-mono">{itinerary.lifehack_tip}</span>
        </div>
      )}

      {/* Journey Legs */}
      <div className="py-4 space-y-3">
        {/* Leg 1 */}
        <div className="p-3.5 rounded-lg bg-zinc-50/70 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2 border-b border-zinc-200/50 dark:border-zinc-800/50">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                {leg1.train_no}
              </span>
              <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                {leg1.train_name}
              </span>

              {leg1.category && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold">
                  {leg1.category.badge}
                </span>
              )}

              {/* View Schedule Button */}
              {onOpenSchedule && (
                <button
                  type="button"
                  onClick={() => onOpenSchedule(leg1.train_no, leg1.train_name, leg1.from, leg1.to)}
                  className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white underline underline-offset-2 ml-2 transition"
                >
                  <MapPin className="w-3 h-3" />
                  Stops
                </button>
              )}

              {/* Coach Layout Button */}
              {onOpenCoachLayout && (
                <button
                  type="button"
                  onClick={() => onOpenCoachLayout(leg1.train_no, leg1.train_name)}
                  className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white underline underline-offset-2 transition"
                >
                  <LayoutGrid className="w-3 h-3" />
                  Seats
                </button>
              )}
            </div>

            <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              Duration: <strong className="text-zinc-800 dark:text-zinc-200">{leg1.duration}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-mono uppercase text-zinc-400 block">Departure</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-white text-sm">{leg1.from}</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300 font-semibold block">{leg1.departure}</span>
            </div>

            <div>
              <span className="text-[10px] font-mono uppercase text-zinc-400 block">Arrival</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-white text-sm">{leg1.to}</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300 font-semibold block">{leg1.arrival}</span>
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

        {/* Transfer Callout */}
        {leg2 && !isSplit && (
          <div className="relative pl-6 py-2">
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-zinc-300 dark:bg-zinc-700 border-dashed" />
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800/60 rounded-lg text-xs font-mono space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-zinc-900 dark:text-white">
                  Transfer at {itinerary.hub} ({itinerary.transfer_type})
                </span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Layover: {itinerary.layover_str}
                </span>
              </div>
              {itinerary.inter_station_transfer && (
                <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 pt-1">
                  <Car className="w-3.5 h-3.5 text-zinc-500" />
                  <span>
                    Cross-city transit required: {leg1.to} &rarr; {leg2.from} (~{itinerary.hub_distance_km}km, ~{itinerary.recommended_cab_mins}m cab)
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Leg 2 */}
        {leg2 && (
          <div className="p-3.5 rounded-lg bg-zinc-50/70 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2 border-b border-zinc-200/50 dark:border-zinc-800/50">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                  {leg2.train_no}
                </span>
                <span className="text-sm font-semibold text-zinc-900 dark:text-white">
                  {leg2.train_name}
                </span>

                {onOpenSchedule && (
                  <button
                    type="button"
                    onClick={() => onOpenSchedule(leg2.train_no, leg2.train_name, leg2.from, leg2.to)}
                    className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white underline underline-offset-2 ml-2 transition"
                  >
                    <MapPin className="w-3 h-3" />
                    Stops
                  </button>
                )}
              </div>

              <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                Duration: <strong className="text-zinc-800 dark:text-zinc-200">{leg2.duration}</strong>
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-mono uppercase text-zinc-400 block">{isSplit ? 'Intermediate' : 'Departing Hub'}</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-white text-sm">{leg2.from}</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300 font-semibold block">{leg2.departure}</span>
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-zinc-400 block">Final Destination</span>
                <span className="font-mono font-bold text-zinc-900 dark:text-white text-sm">{leg2.to}</span>
                <span className="font-mono text-zinc-700 dark:text-zinc-300 font-semibold block">{leg2.arrival}</span>
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
      <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-mono uppercase text-zinc-400 mr-1 font-bold">
            Fares:
          </span>
          {itinerary.fares_by_class && Object.keys(itinerary.fares_by_class).length > 0 ? (
            Object.entries(itinerary.fares_by_class).map(([cls, fare]) => (
              <button
                key={cls}
                type="button"
                onClick={() => onOpenFareBreakdown && onOpenFareBreakdown(fare, cls, leg1.train_no, leg1.train_name)}
                className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 transition cursor-pointer"
                title="Click to view tariff breakdown"
              >
                {cls}: ₹{fare}
              </button>
            ))
          ) : (
            <span className="text-xs font-mono text-zinc-400">Calculated upon booking</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Watchdog Alert */}
          {onOpenWatchdog && (
            <button
              type="button"
              onClick={() => onOpenWatchdog(leg1.train_no, leg1.train_name, leg1.from, leg1.to, itinerary.best_fare_class || '3A')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
              title="Alert me when berths become available"
            >
              <Bell className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Watchdog</span>
            </button>
          )}

          {/* Share / Export */}
          {onOpenExportShare && (
            <button
              type="button"
              onClick={() => onOpenExportShare(itinerary)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
              title="Share itinerary via WhatsApp or Print"
            >
              <Share2 className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Share</span>
            </button>
          )}

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-zinc-500" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Direct IRCTC Booking */}
          <a
            href={irctcBookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition shadow-xs"
          >
            <span>Book on IRCTC</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
