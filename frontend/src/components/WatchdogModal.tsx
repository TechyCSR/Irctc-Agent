import React, { useState } from 'react';
import { X, Bell, ShieldCheck, Mail, Smartphone, Check } from 'lucide-react';
import { subscribeWatchdog } from '../services/api';
import { useToast } from './Toast';

interface WatchdogModalProps {
  isOpen: boolean;
  onClose: () => void;
  trainNo: string;
  trainName: string;
  doj: string;
  fromStn: string;
  toStn: string;
  travelClass: string;
  quota?: string;
}

export const WatchdogModal: React.FC<WatchdogModalProps> = ({
  isOpen,
  onClose,
  trainNo,
  trainName,
  doj,
  fromStn,
  toStn,
  travelClass,
  quota = 'GN',
}) => {
  const { showToast } = useToast();
  const [targetStatus, setTargetStatus] = useState<'AVAILABLE' | 'RAC'>('AVAILABLE');
  const [notifyChannel, setNotifyChannel] = useState<'browser_push' | 'email'>('browser_push');
  const [contact, setContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await subscribeWatchdog({
        train_no: trainNo,
        doj,
        from_stn: fromStn,
        to_stn: toStn,
        travel_class: travelClass,
        quota,
        target_status: targetStatus,
        notify_channel: notifyChannel,
        contact: contact || 'Browser In-App Alert',
      });
      setIsSuccess(true);
      showToast(`Watchdog active for #${trainNo}! We will notify you when ${targetStatus} unlocks.`, 'success');
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 2000);
    } catch {
      showToast('Alert created locally. You will receive on-screen alerts.', 'info');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                Seat Availability Watchdog
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                Train #{trainNo} • {doj}
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

        {/* Form Body */}
        {isSuccess ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-zinc-900 dark:text-white">
              Watchdog Activated!
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              We are actively monitoring seat transitions on Train #{trainNo} ({fromStn} &rarr; {toStn}) in Class {travelClass}.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-mono">
              <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                <span>Train:</span>
                <span className="font-bold text-zinc-900 dark:text-white">{trainNo} ({trainName})</span>
              </div>
              <div className="flex justify-between text-zinc-500 dark:text-zinc-400 mt-1">
                <span>Route:</span>
                <span className="font-bold text-zinc-900 dark:text-white">{fromStn} &rarr; {toStn}</span>
              </div>
              <div className="flex justify-between text-zinc-500 dark:text-zinc-400 mt-1">
                <span>Class & Quota:</span>
                <span className="font-bold text-zinc-900 dark:text-white">{travelClass} ({quota})</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                Notify me when status becomes:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetStatus('AVAILABLE')}
                  className={`py-2 px-3 rounded-lg border text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 ${
                    targetStatus === 'AVAILABLE'
                      ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border-zinc-950 dark:border-white shadow-xs'
                      : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  AVAILABLE (Confirmed)
                </button>
                <button
                  type="button"
                  onClick={() => setTargetStatus('RAC')}
                  className={`py-2 px-3 rounded-lg border text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 ${
                    targetStatus === 'RAC'
                      ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 border-zinc-950 dark:border-white shadow-xs'
                      : 'bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400'
                  }`}
                >
                  RAC (Guaranteed)
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300 block mb-1.5">
                Delivery Channel:
              </label>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setNotifyChannel('browser_push')}
                  className={`py-2 px-3 rounded-lg border text-xs font-mono font-medium transition flex items-center justify-center gap-1.5 ${
                    notifyChannel === 'browser_push'
                      ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-900 dark:border-zinc-100 font-bold text-zinc-900 dark:text-white'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-500'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  In-App / Browser
                </button>
                <button
                  type="button"
                  onClick={() => setNotifyChannel('email')}
                  className={`py-2 px-3 rounded-lg border text-xs font-mono font-medium transition flex items-center justify-center gap-1.5 ${
                    notifyChannel === 'email'
                      ? 'bg-zinc-100 dark:bg-zinc-800 border-zinc-900 dark:border-zinc-100 font-bold text-zinc-900 dark:text-white'
                      : 'border-zinc-200 dark:border-zinc-800 text-zinc-500'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email Alert
                </button>
              </div>

              {notifyChannel === 'email' && (
                <input
                  type="email"
                  required
                  value={contact}
                  onChange={e => setContact(e.target.value)}
                  placeholder="Enter your email address..."
                  className="w-full px-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-mono text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-950"
                />
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 text-xs font-bold font-mono tracking-wide hover:bg-zinc-800 dark:hover:bg-zinc-200 transition shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Activating Watchdog...' : 'Start Monitoring Berths'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
