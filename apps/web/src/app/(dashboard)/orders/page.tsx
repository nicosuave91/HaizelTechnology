'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface OrderCard {
  id: string;
  loanId: string;
  service: 'APPRAISAL' | 'TITLE' | 'FLOOD' | 'MI' | 'SSA89' | '4506-C';
  status: 'DRAFT' | 'SUBMITTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  vendor: string;
  slaDueAt?: string | null;
}

interface VendorHealthMetric {
  vendor: string;
  latencyMs: number;
  failureRate: number;
  status: 'healthy' | 'degraded' | 'down';
}

interface OrdersDashboardData {
  orders: OrderCard[];
  vendorHealth: VendorHealthMetric[];
}

const demoOrders: OrdersDashboardData = {
  orders: [
    {
      id: 'order-1',
      loanId: 'LN-10234',
      service: 'FLOOD',
      status: 'SUBMITTED',
      vendor: 'CoreLogic Flood',
      slaDueAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'order-2',
      loanId: 'LN-19822',
      service: 'TITLE',
      status: 'IN_PROGRESS',
      vendor: 'First American Title',
      slaDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'order-3',
      loanId: 'LN-20931',
      service: 'SSA89',
      status: 'FAILED',
      vendor: 'SSA Gateway',
      slaDueAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'order-4',
      loanId: 'LN-18002',
      service: 'APPRAISAL',
      status: 'COMPLETED',
      vendor: 'Mercury Network',
      slaDueAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    },
  ],
  vendorHealth: [
    { vendor: 'CoreLogic Flood', latencyMs: 5200, failureRate: 0.02, status: 'healthy' },
    { vendor: 'SSA Gateway', latencyMs: 8200, failureRate: 0.11, status: 'degraded' },
    { vendor: 'First American Title', latencyMs: 4600, failureRate: 0.04, status: 'healthy' },
  ],
};

export default function OrdersPage() {
  const [viewStatus, setViewStatus] = useState<
    'SUBMITTED' | 'IN_PROGRESS' | 'FAILED' | 'COMPLETED'
  >('SUBMITTED');
  const { data } = useQuery<OrdersDashboardData>({
    queryKey: ['orders-dashboard', viewStatus],
    queryFn: async () => demoOrders,
    staleTime: 30_000,
  });

  const statuses: Array<{
    key: 'SUBMITTED' | 'IN_PROGRESS' | 'FAILED' | 'COMPLETED';
    label: string;
  }> = [
    { key: 'SUBMITTED', label: 'Submitted' },
    { key: 'IN_PROGRESS', label: 'In Progress' },
    { key: 'FAILED', label: 'Failed' },
    { key: 'COMPLETED', label: 'Completed' },
  ];

  const grouped = statuses.map((column) => ({
    column,
    orders: (data?.orders ?? []).filter((order) => order.status === column.key),
  }));

  return (
    <main className="flex flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-100">Orders Hub</h1>
          <p className="text-sm text-slate-400">Track vendor pipeline, SLA performance, and retry workflows.</p>
        </div>
        <div className="flex gap-2 rounded border border-slate-700 p-1">
          {statuses.map((status) => (
            <button
              key={status.key}
              onClick={() => setViewStatus(status.key)}
              className={`rounded px-3 py-1 text-sm font-medium transition ${
                viewStatus === status.key ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[3fr_1fr]">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 shadow-inner">
          <h2 className="text-lg font-semibold text-slate-100">Orders Board</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {grouped.map(({ column, orders }) => (
              <div key={column.key} className="rounded border border-slate-800 bg-slate-900/40 p-3">
                <div className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-200">
                  <span>{column.label}</span>
                  <span className="text-xs text-slate-400">{orders.length}</span>
                </div>
                <div className="space-y-3">
                  {orders.length === 0 && (
                    <p className="text-xs text-slate-500">No orders in this stage.</p>
                  )}
                  {orders.map((order) => (
                    <article key={order.id} className="space-y-2 rounded border border-slate-800 bg-slate-950/60 p-3 text-xs">
                      <div className="flex items-center justify-between text-slate-200">
                        <span className="font-semibold">{order.loanId}</span>
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                          {order.service}
                        </span>
                      </div>
                      <div className="text-slate-400">Vendor: {order.vendor}</div>
                      <SlaBadge sla={order.slaDueAt} />
                      <button className="w-full rounded border border-indigo-500/60 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-200 hover:bg-indigo-500/20">
                        View Timeline
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <VendorHealthPanel vendorHealth={data?.vendorHealth ?? []} />
          <RetryPanel />
        </aside>
      </section>
    </main>
  );
}

function VendorHealthPanel({ vendorHealth }: { vendorHealth: VendorHealthMetric[] }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 shadow-inner">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Vendor Health</h3>
      <div className="mt-3 space-y-3">
        {vendorHealth.map((metric) => (
          <div key={metric.vendor} className="rounded border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-100">{metric.vendor}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${healthTone(metric.status)}`}>
                {metric.status}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span>Latency</span>
              <span className="font-mono">{Math.round(metric.latencyMs / 100) / 10}s</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Failure</span>
              <span className="font-mono">{(metric.failureRate * 100).toFixed(1)}%</span>
            </div>
            <button className="mt-3 w-full rounded border border-slate-700 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-200 hover:bg-slate-800">
              Reroute
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RetryPanel() {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 shadow-inner text-sm text-slate-300">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Retries &amp; DLQ</h3>
      <p className="mt-2 text-xs text-slate-400">
        Monitor retry budgets and move exhausted attempts into the DLQ. Use the replay control below once a
        vendor is healthy.
      </p>
      <div className="mt-3 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span>Active Retries</span>
          <span className="font-mono">3</span>
        </div>
        <div className="flex items-center justify-between">
          <span>DLQ Items</span>
          <span className="font-mono text-rose-200">1</span>
        </div>
      </div>
      <button className="mt-4 w-full rounded border border-emerald-500/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-200 hover:bg-emerald-500/20">
        Replay DLQ
      </button>
    </div>
  );
}

function SlaBadge({ sla }: { sla?: string | null }) {
  if (!sla) {
    return <span className="text-[10px] text-slate-400">No SLA</span>;
  }
  const due = new Date(sla);
  const remaining = due.getTime() - Date.now();
  const tone = remaining < 0 ? 'bg-rose-900/40 text-rose-200' : remaining < 6 * 60 * 60 * 1000 ? 'bg-amber-900/40 text-amber-200' : 'bg-emerald-900/40 text-emerald-200';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${tone}`}>
      SLA {remaining < 0 ? 'Overdue' : `${Math.ceil(remaining / (60 * 60 * 1000))}h`}
    </span>
  );
}

function healthTone(status: VendorHealthMetric['status']) {
  switch (status) {
    case 'healthy':
      return 'bg-emerald-900/40 text-emerald-200';
    case 'degraded':
      return 'bg-amber-900/40 text-amber-200';
    case 'down':
      return 'bg-rose-900/40 text-rose-200';
  }
}
