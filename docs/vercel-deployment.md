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
