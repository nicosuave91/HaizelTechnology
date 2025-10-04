# M1 Data Fabric Baseline

These SQL scripts are organized to bootstrap a governed, multi-tenant data fabric. They are intended to be applied sequentially in order to provision tenancy primitives, enforce row-level security (RLS), expose masked views, and wire in observability around audit and disaster recovery exercises.

| Script | Purpose |
| --- | --- |
| `001-tenancy.sql` | Creates core helper functions and tenancy-governed tables with governance metadata. |
| `002-rls.sql` | Enables and defines RLS policies using the helper functions to scope all access per tenant and role. |
| `003-masking.sql` | Provides security barrier masking views plus privileged unmasking stored procedures with audit hooks. |
| `004-hash-chain.sql` | Installs event hashing triggers and a verification routine used to detect tampering. |
| `005-pitr-scaffolding.sql` | Captures PITR drill state, helper procedures, and DR feature flag helpers. |

Each script uses `IF NOT EXISTS`/`ADD COLUMN IF NOT EXISTS` semantics so that it can be re-run during iterative development or replayed in lower environments.
