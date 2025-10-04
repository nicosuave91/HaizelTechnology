import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

const API_BASE = __ENV.API_BASE ?? 'http://localhost:3000/v1';
const TOKEN = __ENV.API_TOKEN ?? 'dev-token';
const TENANT = __ENV.TENANT_ID ?? 'tenant-alpha';

export default function () {
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': `${__ITER}-${__VU}-${Date.now()}`,
    'x-tenant-id': TENANT,
  };

  const payload = JSON.stringify({
    scenarioA: {
      scenarioKey: 'A',
      fico: 760,
      ltv: 80,
      cltv: 80,
      productCode: 'CONV-30FXD',
      lockPeriodDays: 45,
    },
    scenarioB: {
      scenarioKey: 'B',
      fico: 700,
      ltv: 90,
      cltv: 90,
      productCode: 'CONV-30FXD',
      lockPeriodDays: 45,
    },
  });

  const res = http.post(`${API_BASE}/pricing/quotes`, payload, { headers });
  check(res, {
    'status 200': (r) => r.status === 200,
    'has comparison': (r) => r.json('comparison.deltaRate') !== undefined,
  });

  sleep(1);
}
