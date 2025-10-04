'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { LockActionsDrawer, LockResource } from './LockActionsDrawer';
import { ScenarioDrawer } from './ScenarioDrawer';
import { ExceptionDrawer, ExceptionResource } from './ExceptionDrawer';

const DEV_TOKEN_ENDPOINT = '/api/mock-login';
const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3000/v1';

type ScenarioForm = {
  scenarioKey: string;
  fico: number;
  ltv: number;
  cltv: number;
  productCode: string;
  lockPeriodDays: number;
};

interface PricingResponse {
  scenarioA: any;
  scenarioB: any;
  comparison: any;
}

export function PricingLocksPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string>('');
  const [scenarioA, setScenarioA] = useState<ScenarioForm>({
    scenarioKey: 'Scenario-A',
    fico: 760,
    ltv: 80,
    cltv: 80,
    productCode: 'CONV-30FXD',
    lockPeriodDays: 45,
  });
  const [scenarioB, setScenarioB] = useState<ScenarioForm>({
    scenarioKey: 'Scenario-B',
    fico: 700,
    ltv: 90,
    cltv: 90,
    productCode: 'CONV-30FXD',
    lockPeriodDays: 45,
  });
  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [history, setHistory] = useState<PricingResponse[]>([]);
  const [locks, setLocks] = useState<LockResource[]>([]);
  const [selectedLock, setSelectedLock] = useState<LockResource | null>(null);
  const [exceptions, setExceptions] = useState<ExceptionResource[]>([]);
  const [selectedException, setSelectedException] = useState<ExceptionResource | null>(null);
  const [scenarioDrawerOpen, setScenarioDrawerOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [savedViews, setSavedViews] = useState<ScenarioForm[]>([]);

  useEffect(() => {
    const savedToken = localStorage.getItem('haizel.dev.token');
    const savedTenant = localStorage.getItem('haizel.dev.tenant');
    if (savedToken) {
      setToken(savedToken);
      if (savedTenant) setTenantId(savedTenant);
      void refreshData(savedToken);
    }
    const storedViews = localStorage.getItem('haizel.pricing.views');
    if (storedViews) {
      setSavedViews(JSON.parse(storedViews));
    }
  }, []);

  const refreshData = useCallback(
    async (jwt: string) => {
      await Promise.all([fetchLocks(jwt), fetchExceptions(jwt)]);
    },
    [],
  );

  const runQuote = useCallback(async () => {
    if (!token) return;
    setMessage('Requesting PPE quote...');
    const response = await fetch(`${API_BASE}/pricing/quotes`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      },
      body: JSON.stringify({
        scenarioA,
        scenarioB,
      }),
    });
    if (!response.ok) {
      setMessage('Failed to load pricing');
      return;
    }
    const payload = (await response.json()) as PricingResponse;
    setPricing(payload);
    setHistory((prev) => [payload, ...prev].slice(0, 10));
    setScenarioDrawerOpen(true);
    setMessage('Pricing received');
  }, [scenarioA, scenarioB, token]);

  const fetchLocks = useCallback(async (jwt: string) => {
    const response = await fetch(`${API_BASE}/locks/watchlist?lteHours=72`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (response.ok) {
      const payload = await response.json();
      setLocks(payload.data ?? []);
    }
  }, []);

  const fetchExceptions = useCallback(async (jwt: string) => {
    const response = await fetch(`${API_BASE}/exceptions?status=pending`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (response.ok) {
      const payload = await response.json();
      setExceptions(payload.data ?? []);
    }
  }, []);

  const handleLogin = async () => {
    const response = await fetch(DEV_TOKEN_ENDPOINT);
    const payload = await response.json();
    localStorage.setItem('haizel.dev.token', payload.token);
    localStorage.setItem('haizel.dev.tenant', payload.tenantId);
    setToken(payload.token);
    setTenantId(payload.tenantId);
    await refreshData(payload.token);
  };

  const handleExtend = async (lock: LockResource, days: number, reason?: string) => {
    if (!token) return;
    await fetch(`${API_BASE}/locks/${lock.id}:extend`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      },
      body: JSON.stringify({ days, reason }),
    });
    await fetchLocks(token);
    setSelectedLock(null);
  };

  const handleFloatDown = async (lock: LockResource) => {
    if (!token) return;
    await fetch(`${API_BASE}/locks/${lock.id}:float-down`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      },
    });
    await fetchLocks(token);
    setSelectedLock(null);
  };

  const handleVoid = async (lock: LockResource) => {
    if (!token) return;
    await fetch(`${API_BASE}/locks/${lock.id}:void`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Idempotency-Key': crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`,
      },
    });
    await fetchLocks(token);
    setSelectedLock(null);
  };

  const handleApproveException = async (id: string, justification: string) => {
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
    await fetchExceptions(token);
    setSelectedException(null);
  };

  const handleDenyException = async (id: string, justification: string) => {
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
    await fetchExceptions(token);
    setSelectedException(null);
  };

  const nearExpiryLocks = useMemo(() => locks.filter((lock) => new Date(lock.expiresAt).getTime() - Date.now() < 48 * 60 * 60 * 1000), [locks]);

  const persistView = (view: ScenarioForm) => {
    const updated = [view, ...savedViews.filter((item) => item.scenarioKey !== view.scenarioKey)].slice(0, 5);
    setSavedViews(updated);
    localStorage.setItem('haizel.pricing.views', JSON.stringify(updated));
  };

  return (
    <main className="space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Pricing & Locks</h1>
          <p className="text-sm text-slate-400">Tenant: {tenantId || 'Not logged in'}</p>
        </div>
        <button
          onClick={handleLogin}
          className="rounded bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
        >
          {token ? 'Refresh Token' : 'Login (Dev)'}
        </button>
      </header>

      <section className="rounded border border-slate-800 p-4">
        <h2 className="text-lg font-semibold">Eligibility Filters</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[{ state: scenarioA, setState: setScenarioA, title: 'Scenario A' }, { state: scenarioB, setState: setScenarioB, title: 'Scenario B' }].map((item) => (
            <div key={item.title} className="rounded border border-slate-800 p-4">
              <h3 className="font-semibold">{item.title}</h3>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <label className="space-y-1">
                  <span className="text-xs uppercase text-slate-400">FICO</span>
                  <input
                    type="number"
                    value={item.state.fico}
                    onChange={(event) => item.setState({ ...item.state, fico: Number(event.target.value) })}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs uppercase text-slate-400">LTV</span>
                  <input
                    type="number"
                    value={item.state.ltv}
                    onChange={(event) => item.setState({ ...item.state, ltv: Number(event.target.value) })}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs uppercase text-slate-400">CLTV</span>
                  <input
                    type="number"
                    value={item.state.cltv}
                    onChange={(event) => item.setState({ ...item.state, cltv: Number(event.target.value) })}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs uppercase text-slate-400">Product</span>
                  <input
                    value={item.state.productCode}
                    onChange={(event) => item.setState({ ...item.state, productCode: event.target.value })}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-xs uppercase text-slate-400">Lock Days</span>
                  <input
                    type="number"
                    value={item.state.lockPeriodDays}
                    onChange={(event) => item.setState({ ...item.state, lockPeriodDays: Number(event.target.value) })}
                    className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
                  />
                </label>
              </div>
              <button
                className="mt-4 rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
                onClick={() => persistView(item.state)}
              >
                Save View
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={runQuote}
            disabled={!token}
            className="rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-emerald-400 disabled:opacity-40"
          >
            Run PPE Quote
          </button>
          <button
            onClick={() => setScenarioDrawerOpen(true)}
            disabled={!pricing}
            className="rounded bg-slate-800 px-4 py-2 text-sm text-slate-200 disabled:opacity-40"
          >
            View Scenario Compare
          </button>
          <span className="text-xs text-slate-400">{message}</span>
        </div>
      </section>

      <section className="rounded border border-slate-800 p-4">
        <h2 className="text-lg font-semibold">Quote Results</h2>
        {pricing ? (
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            {['scenarioA', 'scenarioB'].map((key) => {
              const scenario = (pricing as any)[key];
              return (
                <div key={key} className="rounded border border-slate-800 p-3">
                  <h3 className="font-semibold">{key === 'scenarioA' ? 'Scenario A' : 'Scenario B'}</h3>
                  <p>Rate: {scenario.rate.toFixed(3)}%</p>
                  <p>Price: {scenario.price.toFixed(3)}</p>
                  <p>Lock: {scenario.lockPeriodDays} days</p>
                  <div className="mt-2">
                    <p className="text-xs uppercase text-slate-500">LLPAs</p>
                    <ul className="mt-1 space-y-1">
                      {scenario.llpas.map((item: any) => (
                        <li key={item.code} className="flex items-center justify-between" title={item.description}>
                          <span>{item.code}</span>
                          <span>{item.amount.toFixed(3)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
            <div className="rounded border border-indigo-700 bg-indigo-950/40 p-3">
              <h3 className="font-semibold">Comparison</h3>
              <p>Δ Rate: {pricing.comparison.deltaRate.toFixed(3)}%</p>
              <p>Δ Price: {pricing.comparison.deltaPrice.toFixed(3)}</p>
              <ul className="mt-2 space-y-1 text-xs">
                {pricing.comparison.llpaBreakdown.map((item: any) => (
                  <li key={item.code} className="flex items-center justify-between" title={item.description}>
                    <span>{item.code}</span>
                    <span>{item.amount.toFixed(3)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">No quotes yet. Configure scenarios and run the PPE.</p>
        )}
      </section>

      <section className="rounded border border-slate-800 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Lock Console</h2>
          <span className="text-xs text-amber-400">{nearExpiryLocks.length} locks expiring &lt;48h</span>
        </div>
        <div className="mt-4 grid gap-3">
          {locks.map((lock) => (
            <div key={lock.id} className="rounded border border-slate-800 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Loan {lock.loanId.slice(0, 8)}</p>
                  <p className="text-xs text-slate-400">Expires {new Date(lock.expiresAt).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => setSelectedLock(lock)}
                  className="rounded bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700"
                >
                  Actions
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded border border-slate-800 p-4">
        <h2 className="text-lg font-semibold">Pending Exceptions</h2>
        <div className="mt-4 grid gap-3">
          {exceptions.map((exception) => (
            <div key={exception.id} className="rounded border border-slate-800 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{exception.ruleCode}</p>
                  <p className="text-xs text-slate-400">Loan {exception.loanId.slice(0, 8)} · {exception.type}</p>
                </div>
                <button
                  onClick={() => setSelectedException(exception)}
                  className="rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-900 hover:bg-amber-400"
                >
                  Review
                </button>
              </div>
            </div>
          ))}
          {exceptions.length === 0 && <p className="text-sm text-slate-400">No pending exceptions.</p>}
        </div>
      </section>

      <section className="rounded border border-slate-800 p-4">
        <h2 className="text-lg font-semibold">Scenario History</h2>
        <div className="mt-4 grid gap-3 text-xs">
          {history.map((item, index) => (
            <div key={index} className="rounded border border-slate-800 p-3">
              <p className="font-semibold">Run #{index + 1}</p>
              <p>Δ Rate: {item.comparison.deltaRate.toFixed(3)}% · Δ Price: {item.comparison.deltaPrice.toFixed(3)}</p>
            </div>
          ))}
          {history.length === 0 && <p className="text-slate-400">No runs yet.</p>}
        </div>
      </section>

      <section className="rounded border border-slate-800 p-4">
        <h2 className="text-lg font-semibold">Saved Views</h2>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          {savedViews.map((view) => (
            <button
              key={view.scenarioKey}
              className="rounded border border-slate-700 px-3 py-2 hover:bg-slate-800"
              onClick={() => {
                setScenarioA(view);
                setScenarioB({ ...view, scenarioKey: `${view.scenarioKey}-B` });
              }}
            >
              {view.scenarioKey} · FICO {view.fico} · LTV {view.ltv}
            </button>
          ))}
          {savedViews.length === 0 && <p className="text-slate-400">Save scenarios to recall them later.</p>}
        </div>
      </section>

      <ScenarioDrawer
        open={scenarioDrawerOpen}
        onClose={() => setScenarioDrawerOpen(false)}
        scenarioA={pricing?.scenarioA}
        scenarioB={pricing?.scenarioB}
        comparison={pricing?.comparison}
      />
      <LockActionsDrawer
        lock={selectedLock}
        onClose={() => setSelectedLock(null)}
        onExtend={handleExtend}
        onFloatDown={handleFloatDown}
        onVoid={handleVoid}
      />
      <ExceptionDrawer
        exception={selectedException}
        onClose={() => setSelectedException(null)}
        onApprove={handleApproveException}
        onDeny={handleDenyException}
      />
    </main>
  );
}
