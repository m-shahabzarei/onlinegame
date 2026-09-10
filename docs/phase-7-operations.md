# Phase 7 staging, release and incident runbook

Phase 7 stabilizes existing Phase 1–6 features. It introduces no new game content, permanent progression, monetization, chat, voice, friends, clans, leaderboards or public launch.

## Required staging configuration

Use a dedicated PostgreSQL database, Ably application, Redis REST database, gameplay runtime and secrets. Set `NODE_ENV=production` only in a controlled staging-like environment after all required values are present. Required server values are `DATABASE_URL`, `AUTH_MODE=database`, `NEXT_PUBLIC_APP_URL`, `REALTIME_PROVIDER=ably`, Redis/Ably credentials, `GAMEPLAY_JOIN_SECRET`, `GAMEPLAY_CONTROL_SECRET`, `GAMEPLAY_SERVER_HTTP_URL`, `GAMEPLAY_WS_URL`, `GAMEPLAY_WEB_URL`, `GAMEPLAY_ALLOWED_ORIGINS` and `CRON_SECRET`. Secrets must never use `NEXT_PUBLIC_` names or enter URLs/logs.

## Deployment order

1. Validate configuration, dependency lockfile, Prisma schema and migrations against a staging database copy.
2. Deploy the persistent game server and wait for `/health` and `/ready`.
3. Verify protocol version and origin allowlist.
4. Deploy the Vercel web build with staging-only URLs/secrets.
5. Run the deterministic two-client smoke test and inspect redacted logs.
6. Enable the beta gate/allowlist only after health and rollback checks pass.

## Rollback and active matches

Stop admitting new matches, allow existing leases to end or explicitly drain them, then roll back the game server and web deployment using their platform revisions. Keep the database schema forward compatible; use a compensating migration for data changes rather than destructive rollback. If a server process dies, lease expiry and the sweeper close stale rooms. Never delete active match state as a rollback shortcut.

Rollback triggers are sustained readiness failure, protocol mismatch, duplicate economy/outcome mutations, secret exposure, data-integrity corruption, or a critical security issue. Escalate with the correlation/request id, match id and redacted event code.

## Health endpoints

Web: `/api/health` (configuration health), `/api/health/live` (process liveness), `/api/health/ready` (safe traffic readiness), `/api/version` (service/protocol metadata). Game server: `/health`, `/ready`, `/version`, `/metrics` (bounded operational counters). Responses contain no credentials, cookies, join tickets or database URLs.

## Smoke test

Authenticate or create two guests, create and join a room, ready both clients, reserve/start a match, move and damage one zombie, complete one wave, open the shop, perform one successful and one safely rejected purchase, disconnect/reconnect one client, finish or leave the match, and return to the lobby. Record timestamp, environment, browser versions, request ids and outcome.

## Backup and restore

Use the managed PostgreSQL provider's point-in-time backup policy. Restore only into an isolated database, run Prisma validation and application smoke tests, verify users/rooms/matches and then switch traffic through the normal deployment process. Record recovery point and recovery time assumptions for the chosen provider; destructive restore actions require the database operator.
