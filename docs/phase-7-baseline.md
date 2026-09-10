# Phase 7 baseline and regression inventory

Date: 2026-09-09. This report records the repository as found before Phase 7 changes. The directory is not a Git checkout, so no commit-level diff or author attribution is available; existing files and generated outputs were preserved.

## Architecture

Next.js 16.3.4 serves the web shell and API routes on Vercel. PostgreSQL through Prisma 6.19 stores users, sessions, games, rooms and match metadata. Ably plus Redis REST provide production lobby realtime and distributed ephemeral limits. A separate persistent Node `ws` service owns the fixed-step Rapier simulation, PvE, weapons, economy, objectives and bosses. The browser receives signed short-lived join tickets and sends intent messages; authoritative state is never persisted per tick.

## Baseline checks

| Check                | Result before Phase 7                                             | Notes                                                                                          |
| -------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| ESLint               | Passed                                                            | `npm run lint`                                                                                 |
| TypeScript web       | Passed                                                            | `npm run typecheck`                                                                            |
| Vitest               | Passed with diagnostic stderr and existing skipped/x-marked cases | `npm test -- --reporter=dot`; tick-budget diagnostics are expected under shared-host test load |
| Prisma validate      | Blocked                                                           | `DATABASE_URL` was not set in the shell; schema was not changed                                |
| Game-server build    | Passed                                                            | `npm run game:build`                                                                           |
| Production web build | Not run in the initial pre-flight                                 | Requires a generated Prisma client and a valid build environment                               |
| Browser E2E          | Existing artifacts present; not claimed as a fresh baseline run   | Requires local web and game services                                                           |

## Existing controls and risks

Opaque SHA-256 session digests, HTTP-only SameSite cookies, strict Zod schemas, signed HMAC gameplay tickets, replay guards, origin checks, Redis-backed limits, transactional Prisma room operations, lease-based lifecycle callbacks, fixed-step simulation, bounded WebSocket payloads and reconnect state already existed. Gaps addressed in Phase 7 were response security headers, explicit liveness/readiness/version semantics, bounded local limiter memory, structured redacted logging, safer gameplay request diagnostics, and operator documentation.

## Regression matrix

| Area                                                 | Current coverage                           | Beta gate                |
| ---------------------------------------------------- | ------------------------------------------ | ------------------------ |
| Authentication, guest, profile/settings              | Unit/action tests                          | Two browser contexts     |
| Home, catalog, details                               | Component/page tests                       | Browser smoke            |
| Room create/join, visibility, ready, host transfer   | Lobby unit/integration tests               | Two-client smoke         |
| Reservation and match entry                          | Gameplay service/integration tests         | Two-client smoke         |
| Movement, shooting, reload                           | Protocol and game-server integration       | Two-client smoke         |
| Zombie spawn, waves, damage, down/revive/elimination | PvE unit/integration tests                 | One real wave            |
| Shop, weapons, upgrades, Scrap                       | Phase 6 state tests and server integration | Purchase success/failure |
| Gates, objectives, mini-boss, boss                   | Phase 6 state tests                        | Full staging run         |
| Victory, defeat, scoreboard, leave                   | Match/PvE tests                            | End-to-lobby smoke       |
| Reconnect and cleanup                                | WebSocket integration and lifecycle tests  | Restart/disconnect chaos |

The two-client browser smoke procedure below is required before beta; automated coverage does not replace it.
