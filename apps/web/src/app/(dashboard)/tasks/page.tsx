'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface TaskRecord {
  id: string;
  title: string;
  queueKey: string;
  state: 'NEW' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';
  priority: number;
  dueAt?: string | null;
  slaDueAt?: string | null;
  ownerUserId?: string | null;
  tags: string[];
}

interface QueueAggregate {
  key: string;
  name: string;
  aggregates: {
    total: number;
    new: number;
    inProgress: number;
    blocked: number;
    overdue: number;
  };
}

interface HeatmapCell {
  bucket: string;
  total: number;
  warning: number;
  overdue: number;
}

interface TaskDashboardData {
  personal: TaskRecord[];
  team: TaskRecord[];
  queues: QueueAggregate[];
  heatmap: HeatmapCell[];
}

const demoData: TaskDashboardData = {
  personal: [
    {
      id: 'task-1',
      title: 'Collect updated insurance binder',
      queueKey: 'processor-personal',
      state: 'IN_PROGRESS',
      priority: 2,
      dueAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
      slaDueAt: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
      ownerUserId: 'user-1',
      tags: ['Insurance', 'Follow-up'],
    },
    {
      id: 'task-2',
      title: 'Verify SSA-89 signature',
      queueKey: 'processor-personal',
      state: 'NEW',
      priority: 1,
      dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      slaDueAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      ownerUserId: 'user-1',
      tags: ['SSA-89'],
    },
  ],
  team: [
    {
      id: 'task-3',
      title: 'Order flood certificate',
      queueKey: 'team-flood',
      state: 'BLOCKED',
      priority: 3,
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      slaDueAt: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
      ownerUserId: null,
      tags: ['Flood', 'Orders'],
    },
    {
      id: 'task-4',
      title: 'Review appraisal variance',
      queueKey: 'team-appraisal',
      state: 'NEW',
      priority: 2,
      dueAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      slaDueAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      ownerUserId: null,
      tags: ['Appraisal'],
    },
  ],
  queues: [
    {
      key: 'processor-personal',
      name: 'My Work',
      aggregates: { total: 12, new: 3, inProgress: 6, blocked: 1, overdue: 2 },
    },
    {
      key: 'team-flood',
      name: 'Flood Queue',
      aggregates: { total: 34, new: 12, inProgress: 18, blocked: 4, overdue: 6 },
    },
  ],
  heatmap: Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    date.setHours(9, 0, 0, 0);
    const overdue = index % 3 === 0 ? 2 : 0;
    const warning = index % 2 === 0 ? 3 : 1;
    const total = 6 + index;
    return {
      bucket: date.toISOString(),
      total,
      warning,
      overdue,
    } satisfies HeatmapCell;
  }),
};

export default function TasksPage() {
  const [view, setView] = useState<'personal' | 'team'>('personal');
  const { data } = useQuery<TaskDashboardData>({
    queryKey: ['tasks-dashboard', view],
    queryFn: async () => demoData,
    staleTime: 30_000,
  });

  const tasks = useMemo(() => {
    if (!data) return [];
    return view === 'personal' ? data.personal : data.team;
  }, [data, view]);

  return (
    <main className="flex flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-100">Tasks &amp; Queues</h1>
          <p className="text-sm text-slate-400">Monitor personal and team workloads with live SLA signals.</p>
        </div>
        <div className="flex gap-2 rounded border border-slate-700 p-1">
          {(
            [
              { key: 'personal', label: 'My Tasks' },
              { key: 'team', label: 'Team Queues' },
            ] as const
          ).map((option) => (
            <button
              key={option.key}
              onClick={() => setView(option.key)}
              className={`rounded px-3 py-1 text-sm font-medium transition ${
                view === option.key ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 shadow-inner">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Open Tasks</h2>
            <span className="text-xs text-slate-400">Showing {tasks.length} items</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Queue</th>
                  <th className="px-3 py-2">State</th>
                  <th className="px-3 py-2">Due</th>
                  <th className="px-3 py-2">SLA</th>
                  <th className="px-3 py-2">Tags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-900/40">
                    <td className="px-3 py-2 font-medium">{task.title}</td>
                    <td className="px-3 py-2 text-slate-400">{task.queueKey}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${stateColor(task.state)}`}
                      >
                        {task.state.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-300">{formatDate(task.dueAt)}</td>
                    <td className="px-3 py-2">{renderSlaChip(task.slaDueAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {task.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <aside className="space-y-4">
          <QueueOverview queues={data?.queues ?? []} />
          <Heatmap heatmap={data?.heatmap ?? []} />
        </aside>
      </section>
    </main>
  );
}

function QueueOverview({ queues }: { queues: QueueAggregate[] }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 shadow-inner">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Queue Health</h3>
      <div className="mt-3 space-y-3">
        {queues.map((queue) => (
          <div key={queue.key} className="rounded border border-slate-800 bg-slate-900/50 p-3">
            <div className="flex items-center justify-between text-sm text-slate-200">
              <span className="font-medium">{queue.name}</span>
              <span className="text-xs text-slate-400">{queue.aggregates.total} open</span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 text-xs text-slate-400">
              <Metric label="New" value={queue.aggregates.new} />
              <Metric label="In Progress" value={queue.aggregates.inProgress} />
              <Metric label="Blocked" value={queue.aggregates.blocked} />
              <Metric label="Overdue" value={queue.aggregates.overdue} highlight />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Heatmap({ heatmap }: { heatmap: HeatmapCell[] }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 shadow-inner">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">SLA Heatmap</h3>
      <div className="mt-3 grid grid-cols-7 gap-1">
        {heatmap.map((cell) => (
          <div
            key={cell.bucket}
            className={`flex h-16 flex-col justify-between rounded p-2 text-xs ${heatmapClass(cell)}`}
            title={`${cell.total} tasks`}
          >
            <span className="font-semibold text-slate-100">{new Date(cell.bucket).getDate()}</span>
            <div className="flex items-center justify-between text-[10px] text-slate-200">
              <span>⚠️ {cell.warning}</span>
              <span>⏰ {cell.overdue}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded px-2 py-1 text-center ${highlight ? 'bg-rose-900/40 text-rose-200' : 'bg-slate-900/50 text-slate-300'}`}>
      <div className="text-sm font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide">{label}</div>
    </div>
  );
}

function heatmapClass(cell: HeatmapCell) {
  if (cell.overdue > 0) {
    return 'bg-rose-900/50 border border-rose-500/60';
  }
  if (cell.warning > 2) {
    return 'bg-amber-900/40 border border-amber-500/60';
  }
  return 'bg-emerald-900/30 border border-emerald-500/40';
}

function stateColor(state: TaskRecord['state']) {
  switch (state) {
    case 'NEW':
      return 'bg-blue-900/50 text-blue-200';
    case 'IN_PROGRESS':
      return 'bg-emerald-900/50 text-emerald-200';
    case 'BLOCKED':
      return 'bg-amber-900/60 text-amber-100';
    case 'DONE':
      return 'bg-slate-800 text-slate-300';
  }
}

function formatDate(input?: string | null) {
  if (!input) return '—';
  const date = new Date(input);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(
    date,
  );
}

function renderSlaChip(sla?: string | null) {
  if (!sla) {
    return <span className="text-xs text-slate-400">Not set</span>;
  }
  const due = new Date(sla);
  const remaining = due.getTime() - Date.now();
  const hours = Math.round(remaining / (60 * 60 * 1000));
  const status = remaining < 0 ? 'Overdue' : hours < 12 ? 'At Risk' : 'On Track';
  const tone = remaining < 0 ? 'bg-rose-900/40 text-rose-200' : hours < 12 ? 'bg-amber-900/40 text-amber-200' : 'bg-emerald-900/40 text-emerald-200';
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>
      {status} · {formatDate(sla)}
    </span>
  );
}
