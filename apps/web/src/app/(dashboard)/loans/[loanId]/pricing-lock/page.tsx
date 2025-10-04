'use client';

import { useEffect, useState } from 'react';
import { ScenarioDrawer } from '../../../../components/pricing-locks/ScenarioDrawer';
import { LockActionsDrawer, LockResource } from '../../../../components/pricing-locks/LockActionsDrawer';
import { ExceptionDrawer, ExceptionResource } from '../../../../components/pricing-locks/ExceptionDrawer';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3000/v1';

export default function LoanPricingLockTab({ params }: { params: { loanId: string } }) {
  const [token, setToken] = useState<string | null>(null);
  const [pricing, setPricing] = useState<any>(null);
  const [lock, setLock] = useState<LockResource | null>(null);
  const [exception, setException] = useState<ExceptionResource | null>(null);
  const [scenarioDrawerOpen, setScenarioDrawerOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('haizel.dev.token');
    if (stored) {
      setToken(stored);
      void loadLoanSnapshot(stored);
    }
  }, [params.loanId]);

  const loadLoanSnapshot = async (jwt: string) => {
    const [pricingRes, locksRes, exceptionsRes] = await Promise.all([
      fetch(`${API_BASE}/pricing/quotes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
        },
        body: JSON.stringify({
          loanId: params.loanId,
          scenarioA: { scenarioKey: 'Loan-A', fico: 720, ltv: 80, cltv: 80, productCode: 'CONV-30FXD', lockPeriodDays: 45 },
          scenarioB: { scenarioKey: 'Loan-B', fico: 700, ltv: 85, cltv: 85, productCode: 'CONV-30FXD', lockPeriodDays: 45 },
        }),
      }),
      fetch(`${API_BASE}/locks/watchlist?lteHours=168`, { headers: { Authorization: `Bearer ${jwt}` } }),
      fetch(`${API_BASE}/exceptions?status=pending`, { headers: { Authorization: `Bearer ${jwt}` } }),
    ]);

    if (pricingRes.ok) setPricing(await pricingRes.json());
    if (locksRes.ok) {
      const payload = await locksRes.json();
      const current = (payload.data as LockResource[]).find((item) => item.loanId === params.loanId);
      setLock(current ?? null);
    }
    if (exceptionsRes.ok) {
      const payload = await exceptionsRes.json();
      const pending = (payload.data as ExceptionResource[]).find((item) => item.loanId === params.loanId);
      setException(pending ?? null);
    }
  };

  const handleExtend = async (target: LockResource, days: number, reason?: string) => {
    if (!token) return;
    await fetch(`${API_BASE}/locks/${target.id}:extend`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      },
      body: JSON.stringify({ days, reason }),
    });
    await loadLoanSnapshot(token);
    setLock(null);
  };

  const handleFloatDown = async (target: LockResource) => {
    if (!token) return;
    await fetch(`${API_BASE}/locks/${target.id}:float-down`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      },
    });
    await loadLoanSnapshot(token);
    setLock(null);
  };

  const handleVoid = async (target: LockResource) => {
    if (!token) return;
    await fetch(`${API_BASE}/locks/${target.id}:void`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      },
    });
    await loadLoanSnapshot(token);
    setLock(null);
  };

  const handleApprove = async (id: string, justification: string) => {
    if (!token) return;
    await fetch(`${API_BASE}/exceptions/${id}:approve`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      },
      body: JSON.stringify({ justification }),
    });
    await loadLoanSnapshot(token);
    setException(null);
  };

  const handleDeny = async (id: string, justification: string) => {
    if (!token) return;
    await fetch(`${API_BASE}/exceptions/${id}:deny`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      },
      body: JSON.stringify({ justification }),
    });
    await loadLoanSnapshot(token);
    setException(null);
  };

  return (
    <main className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Loan Pricing & Lock</h1>
        <button
          onClick={() => setScenarioDrawerOpen(true)}
          className="rounded bg-slate-800 px-3 py-1 text-sm text-slate-200"
          disabled={!pricing}
        >
          Open Scenario Drawer
        </button>
      </header>
      <section className="rounded border border-slate-800 p-4 text-sm">
        {pricing ? (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <h2 className="font-semibold">Scenario A</h2>
              <p>Rate {pricing.scenarioA.rate.toFixed(3)}%</p>
              <p>Price {pricing.scenarioA.price.toFixed(3)}</p>
            </div>
            <div>
              <h2 className="font-semibold">Scenario B</h2>
              <p>Rate {pricing.scenarioB.rate.toFixed(3)}%</p>
              <p>Price {pricing.scenarioB.price.toFixed(3)}</p>
            </div>
            <div>
              <h2 className="font-semibold">Delta</h2>
              <p>Δ Rate {pricing.comparison.deltaRate.toFixed(3)}%</p>
              <p>Δ Price {pricing.comparison.deltaPrice.toFixed(3)}</p>
            </div>
          </div>
        ) : (
          <p className="text-slate-400">Loading snapshot…</p>
        )}
      </section>
      <section className="rounded border border-slate-800 p-4 text-sm">
        <h2 className="font-semibold">Current Lock</h2>
        {lock ? (
          <div className="flex items-center justify-between">
            <div>
              <p>Status {lock.status}</p>
              <p>Expires {new Date(lock.expiresAt).toLocaleString()}</p>
            </div>
            <button onClick={() => setLock(lock)} className="rounded bg-slate-800 px-3 py-1 text-xs text-slate-200">
              Manage
            </button>
          </div>
        ) : (
          <p className="text-slate-400">No active lock</p>
        )}
      </section>
      <section className="rounded border border-slate-800 p-4 text-sm">
        <h2 className="font-semibold">Exceptions</h2>
        {exception ? (
          <button onClick={() => setException(exception)} className="rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-900">
            Review Pending Exception
          </button>
        ) : (
          <p className="text-slate-400">No pending exceptions</p>
        )}
      </section>
      <ScenarioDrawer
        open={scenarioDrawerOpen}
        onClose={() => setScenarioDrawerOpen(false)}
        scenarioA={pricing?.scenarioA}
        scenarioB={pricing?.scenarioB}
        comparison={pricing?.comparison}
      />
      <LockActionsDrawer
        lock={lock}
        onClose={() => setLock(null)}
        onExtend={handleExtend}
        onFloatDown={handleFloatDown}
        onVoid={handleVoid}
      />
      <ExceptionDrawer
        exception={exception}
        onClose={() => setException(null)}
        onApprove={handleApprove}
        onDeny={handleDeny}
      />
    </main>
  );
}
