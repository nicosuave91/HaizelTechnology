'use client';

import { useEffect } from 'react';

interface ScenarioResult {
  scenarioKey: string;
  rate: number;
  price: number;
  lockPeriodDays: number;
  llpas: { code: string; description: string; amount: number }[];
  costItems: { label: string; amount: number }[];
  eligibility: Record<string, any>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  scenarioA?: ScenarioResult;
  scenarioB?: ScenarioResult;
  comparison?: { deltaRate: number; deltaPrice: number; llpaBreakdown: { code: string; description: string; amount: number }[] };
}

export function ScenarioDrawer({ open, onClose, scenarioA, scenarioB, comparison }: Props) {
  useEffect(() => {
    if (open) {
      window.location.hash = 'scenario-compare';
    }
    return () => {
      if (window.location.hash === '#scenario-compare') {
        history.replaceState(null, '', window.location.pathname);
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
      <aside className="w-full max-w-4xl bg-slate-950 p-8">
        <header className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Scenario Comparison</h2>
          <button onClick={onClose} className="rounded px-3 py-1 text-sm text-slate-200 hover:bg-slate-800">
            Close
          </button>
        </header>
        <div className="mt-6 grid grid-cols-2 gap-6">
          {[scenarioA, scenarioB].map((scenario, index) => (
            <div key={index} className="rounded border border-slate-800 p-4">
              <h3 className="text-lg font-semibold">Scenario {index === 0 ? 'A' : 'B'}</h3>
              {scenario ? (
                <div className="mt-3 space-y-2 text-sm">
                  <p>Rate: <span className="font-semibold">{scenario.rate.toFixed(3)}%</span></p>
                  <p>Price: <span className="font-semibold">{scenario.price.toFixed(3)}</span></p>
                  <p>Lock Period: {scenario.lockPeriodDays} days</p>
                  <div>
                    <p className="font-semibold">LLPAs</p>
                    <ul className="mt-1 space-y-1">
                      {scenario.llpas.map((llpa) => (
                        <li key={llpa.code} className="flex items-center justify-between" title={llpa.description}>
                          <span>{llpa.code}</span>
                          <span>{llpa.amount.toFixed(3)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold">Costs</p>
                    <ul className="mt-1 space-y-1">
                      {scenario.costItems.map((cost) => (
                        <li key={cost.label} className="flex items-center justify-between">
                          <span>{cost.label}</span>
                          <span>${cost.amount.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-400">No results yet</p>
              )}
            </div>
          ))}
        </div>
        {comparison && (
          <div className="mt-6 rounded border border-indigo-700 bg-indigo-950/40 p-4">
            <h3 className="text-lg font-semibold">Comparison Summary</h3>
            <p className="mt-2 text-sm">Delta Rate: {comparison.deltaRate.toFixed(3)}%</p>
            <p className="text-sm">Delta Price: {comparison.deltaPrice.toFixed(3)}</p>
            <div className="mt-3">
              <p className="text-sm font-semibold">LLPA Breakdown</p>
              <ul className="mt-1 grid grid-cols-2 gap-2 text-sm">
                {comparison.llpaBreakdown.map((item) => (
                  <li key={item.code} className="rounded border border-slate-800 px-3 py-2" title={item.description}>
                    <div className="flex items-center justify-between">
                      <span>{item.code}</span>
                      <span>{item.amount.toFixed(3)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
