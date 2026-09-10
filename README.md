# TwoPlayer

TwoPlayer is a professional online cooperative gaming platform. Phase 3 adds presence, public/private room discovery, invitations, lobby readiness, host controls, reconnect recovery, and reserved preparation sessions on top of Phase 2 authentication, guest access, profiles, and game discovery.

The current release stops at a preparation placeholder. Gameplay, game rendering, matchmaking, chat, voice, progression, results, and monetization remain future work. The existing dark cinematic design system and provider-neutral realtime boundary are retained.

## Stack

- Next.js 16 App Router and React 19
- TypeScript 5.9 in strict mode
- Tailwind CSS 4 with semantic design tokens
- Prisma 6 with PostgreSQL
- Zod 4 for typed configuration and domain validation
- Radix UI primitives and Lucide icons
- Vitest 3 and Testing Library
- ESLint and Prettier

The web application is designed for Vercel. A future authoritative real-time game service is intentionally deployed separately and accessed through the provider-neutral interfaces in `src/realtime`.

## Prerequisites

- Node.js 20.19 or newer
- npm (the manifest records npm 11.18.0)
- PostgreSQL for database-backed development and future persistence work

Local room development needs no cloud account: select `AUTH_MODE=development`, `REALTIME_PROVIDER=local`, and an empty `DATABASE_URL`. These process-local adapters are rejected in production. Persistent deployment uses PostgreSQL, Ably, and Redis REST credentials; see [Phase 3 setup](docs/phase-3-operations.md).

## Local setup

1. Install dependencies:

   ```powershell
   npm install
   ```

2. Create a local environment file from the sanitized example:

   ```powershell
   Copy-Item .env.example .env
   ```

3. For a cloud-free room preview, set `AUTH_MODE=development`, `REALTIME_PROVIDER=local`, and `DATABASE_URL=""`, then skip step 4. For persistent accounts and rooms, replace `DATABASE_URL` with a disposable PostgreSQL connection, retain `AUTH_MODE=database`, and supply the Ably/Redis settings documented above. Do not commit `.env`; it is ignored. Prisma CLI reads the root `.env`, while Next.js also supports `.env.local` for web-only overrides.

4. Validate the schema, generate the Prisma client, and apply it to the disposable local database:

   ```powershell
   npm run db:validate
   npm run db:generate
   npm run db:push
   ```

5. Start the development server:

   ```powershell
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000). The internal component reference remains available at [http://localhost:3000/design-system](http://localhost:3000/design-system).

The health endpoint is available at [http://localhost:3000/api/health](http://localhost:3000/api/health). It reports only sanitized configuration readiness. It never returns database URLs, API keys, or other secret values. A missing or invalid required server configuration produces an HTTP `503` response.

## Environment variables

The configuration layer parses public and server-only values separately. Server configuration is evaluated lazily by server-side code, so a static build does not need a production database or future real-time credentials.

| Variable                      | Scope        | Required                                                    | Purpose                                                                                                 |
| ----------------------------- | ------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                | Server only  | Yes for database mode, Prisma commands, and healthy runtime | PostgreSQL connection used by Prisma; the example is a non-secret local placeholder.                    |
| `AUTH_MODE`                   | Server only  | No; defaults to `database`                                  | `database` persists accounts/sessions. `development` explicitly selects the process-local test adapter. |
| `SESSION_COOKIE_NAME`         | Server only  | No                                                          | HTTP-only session cookie name; defaults to `twoplayer_session`.                                         |
| `SESSION_TTL_DAYS`            | Server only  | No                                                          | Permanent-account session lifetime, constrained to 1–365 days; defaults to 30.                          |
| `NEXT_PUBLIC_APP_URL`         | Browser-safe | No                                                          | Canonical web origin; defaults to `http://localhost:3000` locally. This is the only public variable.    |
| `REALTIME_PROVIDER`           | Server only  | No                                                          | Future adapter identifier; remains `unconfigured`.                                                      |
| `REALTIME_SERVER_URL`         | Server only  | No                                                          | Future external real-time service endpoint using HTTP(S) or WS(S).                                      |
| `REALTIME_SERVER_API_KEY`     | Server only  | No                                                          | Future server-to-server credential; never expose it to client bundles.                                  |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Server only  | No                                                          | Future OpenTelemetry exporter/collector endpoint.                                                       |
| `SENTRY_DSN`                  | Server only  | No                                                          | Future error-reporting endpoint/configuration.                                                          |

Use `.env.example` as the authoritative list and naming reference. Its values are local placeholders, not production credentials.

## Routes

| Route                | Purpose                                                                              |
| -------------------- | ------------------------------------------------------------------------------------ |
| `/`                  | Public discovery home, featured game briefs, and clearly labeled roadmap.            |
| `/games`             | Responsive game catalog with available-preview, coming-soon, and maintenance states. |
| `/games/[slug]`      | Individual game brief; unknown slugs render the game-specific not-found state.       |
| `/login`             | Permanent-account sign in.                                                           |
| `/register`          | Permanent-account registration with server-side validation.                          |
| `/continue-as-guest` | Explicit temporary guest-session onboarding and limitations.                         |
| `/profile`           | Authorized profile display and editing.                                              |
| `/settings`          | Authorized account preferences and logout.                                           |
| `/design-system`     | Internal preview of reusable tokens, components, and interaction states.             |
| `/api/health`        | Sanitized web-service/configuration health response.                                 |
| `/api/auth/logout`   | Same-origin POST endpoint that revokes the current session and expires its cookie.   |

The showcase is not a lobby, room, matchmaking, or gameplay screen.

## Scripts

| Command                | Purpose                                                                       |
| ---------------------- | ----------------------------------------------------------------------------- |
| `npm run dev`          | Run the local Next.js development server with Webpack.                        |
| `npm run build`        | Generate Prisma Client and create a Webpack production build.                 |
| `npm run start`        | Serve an existing production build.                                           |
| `npm run lint`         | Run ESLint.                                                                   |
| `npm run typecheck`    | Run strict TypeScript checks without emitting files.                          |
| `npm test`             | Run the Vitest suite. A file path may be appended for a focused run.          |
| `npm run test:watch`   | Run Vitest in watch mode.                                                     |
| `npm run format`       | Format supported files with Prettier.                                         |
| `npm run format:check` | Check formatting without changing files.                                      |
| `npm run db:format`    | Format `prisma/schema.prisma`.                                                |
| `npm run db:validate`  | Validate `prisma/schema.prisma` against the configured PostgreSQL datasource. |
| `npm run db:generate`  | Generate the Prisma client.                                                   |
| `npm run db:push`      | Apply the schema to a disposable local database (not a production migration). |
| `npm run typegen`      | Refresh Next.js typed-route helpers after adding routes.                      |

Phase 3 adds a migration baseline and an additive room migration. Follow the existing-database baselining or fresh-database instructions in [Phase 3 operations](docs/phase-3-operations.md); `db:push` remains only for disposable local development.

## Source structure

```text
prisma/
  schema.prisma          Durable PostgreSQL model
src/
  app/                   App Router routes and framework-level states
  components/app/        Shared platform shell and responsive navigation
  components/catalog/    Reusable game discovery presentation
  components/forms/      Account/profile/preference form leaves
  components/ui/         Reusable design-system primitives
  components/design-system/
                         Internal component showcase
  config/                Public and server-only environment validation
  db/                    Server-only Prisma client
  domain/                Framework- and ORM-independent domain types/invariants
  realtime/              Provider-neutral contracts, Ably and local adapters
  server/lobby/          Atomic room services, presence leases, and API security
  server/actions/        Validated and authorized Phase 2 mutations
  server/auth/           Replaceable auth service, repositories, password/session security
  server/catalog/        Database/fallback game catalog reads
  server/dal/            Request-scoped session/profile data access
  server/services/       Other server-side application services
  lib/                   Small cross-cutting utilities
docs/                    Architecture, domain, design, and decision records
```

Business rules should stay out of page components. Domain rules belong in `src/domain`; database access belongs in `src/db` and server services; provider-specific real-time code must sit behind `src/realtime` contracts.

## Architecture at a glance

- **Vercel / Next.js:** website, authentication, standard HTTP APIs, authorized room snapshots and commands, and lobby presentation.
- **PostgreSQL / Prisma:** durable users, game catalog, room metadata/membership/readiness, and pending match reservations.
- **Ably and Redis:** direct managed realtime notifications, expiring presence leases, and distributed rate limits. No persistent server runs inside Vercel.
- **Browser:** renders the lobby, subscribes through provider-neutral interfaces, and reconciles authoritative snapshots. An external gameplay service remains a future phase.

See [Architecture](docs/architecture.md), [Domain model](docs/domain-model.md), [Design system](docs/design-system.md), [Phase 1 decisions](docs/phase-1-decisions.md), and [Phase 2 decisions](docs/phase-2-decisions.md) for the detailed contracts and trade-offs.

## Quality expectations

Before handing off a change, run:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm run db:validate
npm run db:generate
npm test -- --reporter=dot --maxWorkers=1 --minWorkers=1
npm run build
```

`DATABASE_URL` must be present for Prisma validation/generation and whenever `AUTH_MODE=database`. It may be omitted only for the explicit, ephemeral `AUTH_MODE=development` preview. Tests and build-only schema generation should use sanitized, non-production values and must never rely on production credentials.

## Phase boundary

Phase 3 adds presence, public/private rooms, shareable invites, readiness, host controls and transfer, reconnect handling, expiration, and reserved preparation sessions. The preparation screen explicitly stops before gameplay. Gameplay, weapons, zombies, waves, chat, voice chat, and matchmaking are not implemented. The Design System showcase remains reference UI.

See [Phase 3 operations and environment](docs/phase-3-operations.md), [verification results](docs/phase-3-verification.md), and [created/modified files](docs/phase-3-files.md).

# Phase 4 gameplay

The reserved lobby session now opens `/play/[matchId]`, a two-player first-person training arena. Vercel serves the website and game client; a separate persistent Node/WebSocket service owns gameplay. This phase includes no zombies or waves.

See [Phase 4 development](docs/phase-4-development.md), [architecture and protocol](docs/phase-4-architecture.md), and [verification](docs/phase-4-verification.md). Run `npm run dev` and `npm run game:dev` in separate terminals after configuring `.env.example`.

## Phase 5 cooperative survival

The existing arena now supports five authoritative zombie waves, Walker/Runner/Spitter/Brute/Screamer AI, rifle head/body damage, player downing, bleed-out, teammate revive, intermission return, team defeat and five-wave completion. Protocol and map version 2 must deploy together. The web/client stays Vercel-compatible; gameplay still needs a persistent external server.

See [Phase 5 architecture and rules](docs/phase-5-architecture.md), [local testing and deployment](docs/phase-5-development.md), [verification and limitations](docs/phase-5-verification.md), and [file inventory](docs/phase-5-files.md). No shops, economy, additional weapons/upgrades, bosses, objectives, rewards, progression, leaderboards, chat or voice chat are included.

# Phase 6

Phase 6 adds the match-only ten-wave production run documented in `docs/phase-6-architecture.md`: five server-validated weapons across primary/secondary slots, Scrap economy with separate Score and Contribution, Safe Room shop and upgrades, armor/medkits/grenades, a bounded Sentry Turret, gate expansion, generator and intel objectives, an elite mini-boss, a two-phase final boss, reconnect snapshots, and an in-match/final scoreboard. Scrap, weapons, upgrades, items, gates, and results never become permanent progression. The web client remains deployable on Vercel; the authoritative gameplay server requires a persistent external runtime.

# Phase 7 stabilization

Phase 7 hardens the existing Phase 1–6 implementation for controlled staging and limited beta: security headers, redacted structured logs, bounded abuse controls, explicit web and game-server liveness/readiness/version endpoints, graceful lifecycle and cleanup checks, protocol/reconnect validation, performance/load/chaos methodology, and release/rollback runbooks. Vercel still hosts the web client and a separate persistent runtime still owns authoritative gameplay. No new game content, permanent progression, monetization, social features, public launch, chat or voice capability is introduced.

See [the Phase 7 baseline](docs/phase-7-baseline.md), [threat model](docs/phase-7-threat-model.md), [operations runbook](docs/phase-7-operations.md), [performance plan](docs/phase-7-performance.md), and [verification record](docs/phase-7-verification.md).

# Phase 8 production release

Phase 8 adds the final release layer around the existing authoritative game: resumable onboarding, match history and profile summaries, bounded server-owned daily/weekly challenges, gameplay-neutral curated cosmetics, privacy-conscious analytics, report/block foundations, safe feature flags, maintenance/status behavior, operator status protection, and production release documentation. No new game content or gameplay power is introduced. Vercel continues to host the web application and client; the persistent external runtime remains authoritative for matches.

See [Phase 8 release readiness](docs/phase-8-release.md) for the release gate, retention policy, deployment boundary, maintenance flow, rollback and incident process.

## Solo and bilingual support

See [docs/solo-and-locales.md](docs/solo-and-locales.md) for solo mode, locale resolution, Persian font loading, and navigation measurement.
