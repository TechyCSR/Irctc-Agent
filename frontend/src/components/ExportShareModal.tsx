import React, { useState } from 'react';
import { X, Share2, Printer, Copy, Check, MessageSquare } from 'lucide-react';
import type { RouteItinerary } from '../types';
import { useToast } from './Toast';

interface ExportShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  itinerary: RouteItinerary;
  fromName: string;
  toName: string;
  doj: string;
}

export const ExportShareModal: React.FC<ExportShareModalProps> = ({
  isOpen,
  onClose,
  itinerary,
  fromName,
  toName,
  doj,
}) => {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const leg1 = itinerary.legs[0];
  const leg2 = itinerary.legs.length > 1 ? itinerary.legs[1] : null;

  const isDirect = itinerary.type === 'DIRECT';
  const isSplit = itinerary.type === 'SAME_TRAIN_SPLIT';
  const isPointBeyond = itinerary.type === 'POINT_BEYOND';

  // Construct WhatsApp Card Message
  const buildWhatsAppText = () => {
    let msg = `🚆 *IRCTC AGENT — TRAVEL PLAN* 🚆\n`;
    msg += `📍 *Route:* ${fromName} (${itinerary.origin}) ➔ ${toName} (${itinerary.destination})\n`;
    msg += `📅 *Date of Journey:* ${doj}\n`;
    msg += `⏱️ *Total Travel Time:* ${itinerary.total_duration_str}\n`;
    msg += `💰 *Best Fare:* ₹${itinerary.best_fare} (${itinerary.best_fare_class})\n`;
    msg += `🛡️ *Status:* ${itinerary.booking_confidence} (${itinerary.confirmation_probability || 95}% probability)\n\n`;

    if (isDirect) {
      msg += `🚂 *Direct Train:* ${leg1.train_no} - ${leg1.train_name}\n`;
      msg += `   • Departs: ${leg1.from} @ ${leg1.departure}\n`;
      msg += `   • Arrives: ${leg1.to} @ ${leg1.arrival}\n`;
    } else if (isSplit) {
      msg += `⚡ *Same-Train Split Trick:* ${leg1.train_no} - ${leg1.train_name}\n`;
      msg += `   • Part 1: ${leg1.from} ➔ ${leg1.to} (${leg1.departure} to ${leg1.arrival})\n`;
      msg += `   • Part 2: ${leg2?.from} ➔ ${leg2?.to} (${leg2?.departure} to ${leg2?.arrival})\n`;
      msg += `   • *No train change needed!* Book both tickets on same train.\n`;
    } else if (isPointBeyond) {
      msg += `🎯 *Alternate Boarding Lifehack:* ${leg1.train_no} - ${leg1.train_name}\n`;
      msg += `   • Book from: ${itinerary.booking_origin} (General Quota)\n`;
      msg += `   • Board at: ${itinerary.boarding_station} (Zero penalty)\n`;
    } else {
      msg += `🔄 *Connecting Route (via ${itinerary.hub}):*\n`;
      msg += `   • Leg 1: ${leg1.train_no} (${leg1.from} ${leg1.departure} ➔ ${leg1.to} ${leg1.arrival})\n`;
      msg += `   • Layover: ${itinerary.layover_str} at ${itinerary.hub} (${itinerary.transfer_type})\n`;
      if (leg2) {
        msg += `   • Leg 2: ${leg2.train_no} (${leg2.from} ${leg2.departure} ➔ ${leg2.to} ${leg2.arrival})\n`;
      }
    }

    if (itinerary.irctc_link) {
      msg += `\n🎫 *Direct Booking Link:*\n${itinerary.irctc_link}\n`;
    }

    msg += `\n_Generated via IRCTC AGENT (https://irctcagent.techycsr.dev)_`;
    return msg;
  };

  const whatsAppText = buildWhatsAppText();
  const whatsAppUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsAppText)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(whatsAppText);
    setCopied(true);
    showToast('Formatted WhatsApp travel card copied!', 'success');
    setTimeout(() => setCopied(false), 2200);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs animate-fade-in no-print">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Export & Share Travel Card
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                Option #{itinerary.rank} • {fromName} &rarr; {toName}
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
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-wider block">
              Formatted WhatsApp Travel Card:
            </label>
            <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 max-h-56 overflow-y-auto text-xs font-mono text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
              {whatsAppText}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs font-mono flex items-center justify-center gap-1.5 transition shadow-xs"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Send via WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={handleCopy}
              className="py-2.5 px-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-bold text-xs font-mono flex items-center justify-center gap-1.5 transition border border-zinc-200 dark:border-zinc-700"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
            </button>
          </div>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={handlePrint}
              className="w-full py-2.5 px-3 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs font-mono flex items-center justify-center gap-1.5 transition shadow-sm hover:bg-zinc-800 dark:hover:bg-zinc-200"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save Clean PDF Itinerary</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
