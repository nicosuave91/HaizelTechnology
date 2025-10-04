'use client';

import { useState } from 'react';

export interface LockResource {
  id: string;
  loanId: string;
  status: string;
  expiresAt: string;
  lockPeriodDays: number;
  productRef: string;
  rate: number;
  price: number;
  actions: any[];
}

interface Props {
  lock: LockResource | null;
  onClose: () => void;
  onExtend: (lock: LockResource, days: number, reason?: string) => Promise<void>;
  onFloatDown: (lock: LockResource) => Promise<void>;
  onVoid: (lock: LockResource) => Promise<void>;
}

export function LockActionsDrawer({ lock, onClose, onExtend, onFloatDown, onVoid }: Props) {
  const [days, setDays] = useState(5);
  const [reason, setReason] = useState('Investor condition');
  const [busy, setBusy] = useState(false);
  if (!lock) return null;

  const handleExtend = async () => {
    setBusy(true);
    await onExtend(lock, days, reason);
    setBusy(false);
  };

  const handleFloatDown = async () => {
    setBusy(true);
    await onFloatDown(lock);
    setBusy(false);
  };

  const handleVoid = async () => {
    setBusy(true);
    await onVoid(lock);
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <aside className="w-full max-w-md bg-slate-900 p-6 shadow-xl">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Lock Actions</h2>
            <p className="text-sm text-slate-400">Lock #{lock.id.slice(0, 8)} · Expires {new Date(lock.expiresAt).toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="rounded px-3 py-1 text-sm text-slate-200 hover:bg-slate-800">
            Close
          </button>
        </header>

        <section className="mt-6 space-y-4">
          <div className="rounded border border-slate-700 p-4">
            <h3 className="font-medium">Extend Lock</h3>
            <p className="text-xs text-slate-400">Adds time while recording justification for audit.</p>
            <div className="mt-3 flex items-center gap-3">
              <label className="text-sm">Days</label>
              <input
                type="number"
                value={days}
                onChange={(event) => setDays(Number(event.target.value))}
                className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                min={1}
                max={30}
              />
            </div>
            <textarea
              className="mt-3 w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason for extension"
            />
            <button
              disabled={busy}
              onClick={handleExtend}
              className="mt-3 w-full rounded bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50"
            >
              Extend
            </button>
          </div>

          <div className="rounded border border-slate-700 p-4 space-y-3">
            <div>
              <h3 className="font-medium">Float Down</h3>
              <p className="text-xs text-slate-400">Requires float-down approval scope.</p>
            </div>
            <button
              disabled={busy}
              onClick={handleFloatDown}
              className="w-full rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-50"
            >
              Apply Float Down
            </button>
          </div>

          <div className="rounded border border-red-700 p-4 space-y-3">
            <div>
              <h3 className="font-medium text-red-300">Void Lock</h3>
              <p className="text-xs text-red-200">Voiding locks is irreversible and will be audited.</p>
            </div>
            <button
              disabled={busy}
              onClick={handleVoid}
              className="w-full rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              Void Lock
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}
