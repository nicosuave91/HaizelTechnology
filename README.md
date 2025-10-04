# Haizel Broker/Lender Platform Monorepo

This repository provides the baseline developer experience for the Haizel broker/lender platform. It includes a Next.js web dashboard, NestJS API, Temporal worker, shared packages, and local infrastructure via Docker Compose.

## Quickstart

```bash
pnpm install
cp .env.example .env.local
pnpm dev:up
pnpm -w dev
```

Services run on the following ports by default:

| Service | URL |
| --- | --- |
| Web | http://localhost:3000 |
| API | http://localhost:4000/healthz |
| Temporal UI | http://localhost:8233 |
| Mailpit | http://localhost:8025 |
| MinIO | http://localhost:9001 |
| Grafana | http://localhost:3002 |
| Jaeger | http://localhost:16686 |

## Seed Data

```bash
pnpm db:migrate
pnpm db:seed
```

Seeds create two tenants, three users, a sample loan, and an audit event. Use the web app “Login (Dev)” to retrieve a mock token and load tenant data.

## Environment Validation

Ensure all required variables are set:

```bash
pnpm check-env
```

## Testing and Quality

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Troubleshooting

- Ensure Docker Desktop resources are sufficient (≥4 CPU, ≥8 GB RAM).
- Windows users should install build tools for native dependencies.
- Port conflicts can be resolved by editing `.env.local` to override service ports.

## UAC Verification

1. **Boot & Run**: `pnpm install && pnpm dev:up && pnpm -w dev` brings up the stack.
2. **Health Check**: `curl -i http://localhost:4000/healthz` returns status JSON and trace header.
3. **Auth & Tenancy**: Use the web dashboard login; API replies include `x-tenant-id`.
4. **Observability**: Triggering a loan list loads spans visible in Jaeger.
5. **Idempotency**: Issue POST with `Idempotency-Key` twice to observe 409 replay response.
