'use client';

import { useState } from 'react';

export interface ExceptionResource {
  id: string;
  loanId: string;
  ruleCode: string;
  pricingCode?: string;
  type: string;
  status: string;
  justification: string;
  requestedBy: string;
  approverUserId?: string;
  expiresAt?: string | null;
  auditTrail: { action: string; actor: string; at: string; justification?: string }[];
}

interface Props {
  exception: ExceptionResource | null;
  onClose: () => void;
  onApprove: (id: string, justification: string) => Promise<void>;
  onDeny: (id: string, justification: string) => Promise<void>;
}

export function ExceptionDrawer({ exception, onClose, onApprove, onDeny }: Props) {
  const [justification, setJustification] = useState('Meets compensating factors');
  const [busy, setBusy] = useState(false);

  if (!exception) return null;

  const handleApprove = async () => {
    setBusy(true);
    await onApprove(exception.id, justification);
    setBusy(false);
  };

  const handleDeny = async () => {
    setBusy(true);
    await onDeny(exception.id, justification);
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <aside className="w-full max-w-lg bg-slate-900 p-6">
        <header className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Exception Details</h2>
            <p className="text-sm text-slate-400">Rule {exception.ruleCode} · Status {exception.status}</p>
          </div>
          <button onClick={onClose} className="rounded px-3 py-1 text-sm text-slate-200 hover:bg-slate-800">
            Close
          </button>
        </header>

        <section className="mt-4 space-y-3 text-sm">
          <p><span className="font-semibold">Loan:</span> {exception.loanId}</p>
          <p><span className="font-semibold">Type:</span> {exception.type}</p>
          <p><span className="font-semibold">Requested By:</span> {exception.requestedBy}</p>
          <p><span className="font-semibold">Justification:</span> {exception.justification}</p>
          <div>
            <p className="font-semibold">Audit Trail</p>
            <ul className="mt-2 space-y-2 text-xs">
              {exception.auditTrail.map((entry, index) => (
                <li key={`${entry.action}-${index}`} className="rounded border border-slate-700 p-2">
                  <p className="font-semibold">{entry.action}</p>
                  <p>{entry.actor} · {new Date(entry.at).toLocaleString()}</p>
                  {entry.justification && <p className="text-slate-300">{entry.justification}</p>}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-6 space-y-3">
          <textarea
            className="w-full rounded border border-slate-700 bg-slate-950 p-2 text-sm"
            value={justification}
            onChange={(event) => setJustification(event.target.value)}
          />
          <div className="flex gap-3">
            <button
              disabled={busy}
              onClick={handleApprove}
              className="flex-1 rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-50"
            >
              Approve
            </button>
            <button
              disabled={busy}
              onClick={handleDeny}
              className="flex-1 rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              Deny
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}
