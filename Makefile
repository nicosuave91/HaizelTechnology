.PHONY: dev-up dev-down dev-reset seed migrate

dev-up:
pnpm dev:up

dev-down:
pnpm dev:down

dev-reset:
pnpm dev:reset

seed:
pnpm db:seed

migrate:
pnpm db:migrate
