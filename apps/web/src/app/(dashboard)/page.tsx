'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { getFeatureClient } from '../../lib/featureFlags';

interface LoanResponse {
  id: string;
  userId: string;
  loanNumber: string;
  status: string;
  borrowerName: string;
  amount: string;
}

const DEV_TOKEN_ENDPOINT = '/api/mock-login';

export default function DashboardPage() {
  const [token, setToken] = useState<string | null>(null);
  const [loans, setLoans] = useState<LoanResponse[]>([]);
  const [tenantId, setTenantId] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [showBanner, setShowBanner] = useState<boolean>(false);

  useEffect(() => {
    const stored = localStorage.getItem('haizel.dev.token');
    if (stored) {
      setToken(stored);
      void fetchLoans(stored);
    }
  }, []);

  const fetchLoans = async (jwt: string) => {
    try {
      const response = await axios.get(`${process.env.API_BASE_URL}/loans`, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });
      setLoans(response.data.data);
      setTenantId(response.headers['x-tenant-id'] ?? 'unknown');
      setMessage(`Trace: ${response.headers['traceparent'] ?? 'none'}`);
    } catch (error) {
      setMessage('Failed to load loans');
      console.error(error);
    }
  };

  const onLogin = async () => {
    const response = await fetch(DEV_TOKEN_ENDPOINT);
    const payload = await response.json();
    localStorage.setItem('haizel.dev.token', payload.token);
    setToken(payload.token);
    setTenantId(payload.tenantId);
    const flagClient = getFeatureClient();
    const enabled = await flagClient.getBooleanValue('TENANT_BANNER_EXAMPLE', false, {
      targetingKey: payload.tenantId,
    });
    setShowBanner(enabled);
    void fetchLoans(payload.token);
  };

  return (
    <main className="p-6 space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Haizel Broker Platform</h1>
          <p className="text-sm text-slate-300">Tenant: {tenantId || 'Not logged in'}</p>
        </div>
        <button
          onClick={onLogin}
          className="rounded bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
        >
          Login (Dev)
        </button>
      </header>
      {showBanner && (
        <div className="rounded border border-emerald-500 bg-emerald-900/40 p-3 text-sm">Tenant banner is enabled.</div>
      )}
      {token && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Recent Loans</h2>
          <div className="grid gap-3">
            {loans.map((loan) => (
              <div key={loan.id} className="rounded border border-slate-700 p-4">
                <p className="font-semibold">Loan #{loan.loanNumber}</p>
                <p>Status: {loan.status}</p>
                <p>Borrower: {loan.borrowerName}</p>
                <p>Amount: {loan.amount}</p>
              </div>
            ))}
          </div>
        </section>
      )}
      <footer className="text-xs text-slate-500">{message}</footer>
    </main>
  );
}
