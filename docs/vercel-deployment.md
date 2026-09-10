# Vercel deployment

The root application uses the Next.js preset. The persistent gameplay service
in `services/game-server` needs its own always-on runtime; its in-memory matches
must remain on one process throughout a session.

## Database

Connect a PostgreSQL database as `DATABASE_URL` to Production. The Vercel build
applies the checked-in Prisma migrations, then explicitly seeds Nightfall Protocol
with `prisma/seed-catalog.sql` before building Next.js. The seed only inserts a
missing game; it never reactivates or changes an existing catalog record. No
database reset or destructive schema push is used. Preview builds skip database
migrations and seeding and need a separate database for runtime functionality.

## Runtime configuration

Set `AUTH_MODE=database`, `SESSION_COOKIE_NAME=twoplayer_session`,
`SESSION_TTL_DAYS=30`, and `NEXT_PUBLIC_APP_URL` to the assigned production origin.
Do not import the local development `.env` into Production. Detected environment
variable names with empty values still need configuration; they are not credentials.

Before enabling play, configure the Ably and Upstash variables from
`docs/phase-3-operations.md`, deploy the gameplay service with the matching
join/control secrets and production origins, and verify its health/readiness.
Keep `TWOPLAYER_FLAG_GAME_AVAILABLE=0` until those services are ready.

The Upstash Marketplace integration's `KV_REST_API_URL` and `KV_REST_API_TOKEN`
are accepted automatically when both `UPSTASH_REDIS_REST_*` overrides are empty.
Custom overrides take precedence as a pair; a partial pair fails validation for
the Ably runtime. Keep all Redis credentials server-only.

## Cleanup scheduling on Hobby

Vercel Hobby permits cron jobs only once per day. The checked-in schedule is a
daily fallback, not the required once-per-minute cleanup for live gameplay.
Before enabling matches on Hobby, configure an external scheduler to send
`GET /api/gameplay/sweep` every minute with `Authorization: Bearer <CRON_SECRET>`.
Alternatively, a paid Vercel plan supports restoring the original `* * * * *`
schedule. Do not publish the secret in a URL or commit it to this repository.

## Verification

Check the successful migration output and Ready deployment in Vercel, then visit
the production homepage, `/games`, and `/api/health`. Full gameplay readiness also
requires `/api/health/ready` and the two-client smoke in `docs/phase-7-operations.md`.

## Provisioned production services (2026-09-10)

- Web: https://onlinegame-mu.vercel.app on Vercel Hobby.
- PostgreSQL: Prisma `onlinegame-postgres`, Production integration.
- Redis: Upstash `onlinegame-redis`, Production integration.
- Lobby events: Ably `onlinegame-production`, restricted publish/subscribe key.
- Gameplay: https://onlinegame-server.onrender.com, Render Free, Virginia,
  one Docker instance from `services/game-server/Dockerfile`, repository root
  build context, `/ready` health check. WebSocket path: `/gameplay`.
- Minute cleanup: cron-job.org job `8425598`, authenticated GET to the web
  sweep endpoint. Manual and scheduled executions returned HTTP 200.

Production join/control credentials are independent, and the cron bearer token
is stored only in Vercel and the scheduler. Credentials are not in this document.

Render Free sleeps when inactive; waking can take 50 seconds or more. A first
game attempt can therefore require retrying. This deployment is suitable for
testing within free-tier quotas, not guaranteed always-on service.

The document CSP permits `'wasm-unsafe-eval'` for bundled Rapier physics while
keeping JavaScript `'unsafe-eval'` disabled in production. Test this distinction
with `e2e/csp.spec.ts` against the HTTPS production URL. A rejected WASM load can
currently surface as the game's generic WebGL initialization failure message.

### Release verification

Commit `812bda7` deployed the physics CSP correction. The HTTPS browser CSP
regression passed, as did TypeScript, targeted ESLint and formatting checks.
Two authenticated production guests created/joined a private room and started
a shared match. Browser frames verified synchronized movement and authoritative
ammunition changes. A direct WebSocket smoke also verified disconnect/reconnect
with the same player identity and cooperative match termination on leave.

Full browser reload stability is not certified: two simultaneous software-rendered
Chrome clients experienced reconnects and `SLOT_CONNECTED` errors. A complete wave,
shop purchases, and sustained-load testing were not verified in this deployment.
The free instance's capacity and cold starts remain operational limitations.

Application-silent sockets now expire even if transport pongs continue, and
duplicate-slot rejection uses bounded reconnect retries. A real WebSocket
regression verifies the stale slot is freed after the application silence limit.
