# Phase 4 verification record

Verification date: 2026-09-08. This record separates automated checks and inspected screenshots from human playtesting. The implementation is a real two-client authoritative training slice. Sustained 1080p/60 FPS and subjective motion/audio quality still need a controlled hardware playtest; they are not certified by browser automation.

## Environment and preservation

The source workspace is `D:\shahab\work\work project\2Player`. There is no Git metadata, so no commit was made. The existing cross-drive `node_modules` junction was preserved. Phase 3 already documents its Webpack entry-resolution problem. Builds and tests used the synchronized source in `D:\twoplayer-phase4-verification` with real same-drive dependencies. Test logs are in `D:\twoplayer-phase4-dependencies\final-*.log`.

The baseline suite passed 157 tests with two PostgreSQL tests skipped before implementation. Existing dependencies were not upgraded. Pinned additions are Three.js 0.185.1, Rapier compat 0.20.0, ws 8.21.3, their TypeScript declarations, and Playwright 1.63.0. No previous rendering, physics, gameplay transport or browser testing equivalent was present.

The disposable PostgreSQL 16 fixture used container `twoplayer-phase4-test`, localhost port 15434 and database `phase3_test`. Database integration checks ran against that fixture, not a user database. Local signing keys and fixture configuration were kept outside source. No gameplay tickets or session traces were recorded. See the file manifest for the source-comparison limitation caused by the disk-space incident.

## Commands and results

Commands below ran in the same-drive verification copy unless identified as source installation or baseline. The working npm entry point was `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js"`; invoking it with `run <script>` runs the repository scripts shown below. Resource-limited builds used `NODE_OPTIONS=--max-old-space-size=1536` and D: temporary/cache directories.

| Command                                                                                                                                | Result                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline `npm test -- --maxWorkers=1 --no-file-parallelism`                                                                            | Passed: 157 tests; two DB tests skipped before fixture setup.                                                                                |
| Source `npm install --package-lock-only` with the pinned additions                                                                     | Passed; lockfile updated without upgrading existing direct dependencies.                                                                     |
| Initial isolated C: `npm ci`                                                                                                           | Failed with ENOSPC. This was an environment failure, not a successful install.                                                               |
| D: `npm ci --ignore-scripts --no-audit --no-fund`                                                                                      | Passed; Prisma generation ran explicitly afterward. Playwright was added subsequently at its pinned version.                                 |
| Final `npm ci --ignore-scripts --dry-run --no-audit --no-fund`                                                                         | Passed: lockfile/install consistency check; no version changes.                                                                              |
| `npm run typegen`                                                                                                                      | Passed after final code changes.                                                                                                             |
| `npm run typecheck`                                                                                                                    | Passed after final code changes.                                                                                                             |
| `npm run lint`                                                                                                                         | Passed after final code changes.                                                                                                             |
| `npm test -- --maxWorkers=1 --no-file-parallelism` with `LOBBY_TEST_DATABASE_URL`                                                      | Passed: 212 tests across 36 files, zero skipped, in 118.56 seconds.                                                                          |
| `npm run test:game`                                                                                                                    | Passed latest focused run: 48 tests; one DB test skipped because this run omitted the DB variable. The full suite includes the real DB test. |
| `npm run build` with production auth/database mode                                                                                     | Passed: optimized Next 16.3.4 build including `/play/[matchId]` and finite gameplay API routes. Repeated after the final cleanup change.     |
| `npm run game:build`                                                                                                                   | Passed; separate server output emitted under `dist/game-server`.                                                                             |
| `node node_modules/prisma/build/index.js migrate deploy`                                                                               | Passed: all three migrations applied to the disposable fixture.                                                                              |
| `npm run db:validate`                                                                                                                  | Passed.                                                                                                                                      |
| `node node_modules/prisma/build/index.js migrate diff --from-url <fixture-url> --to-schema-datamodel prisma/schema.prisma --exit-code` | Passed: no schema difference.                                                                                                                |
| `npm run test:e2e` with existing Chrome                                                                                                | Passed final expanded scenario: one test in about 1.2 minutes, including terminal socket closure and automatic return; no page errors.       |
| `npm run game:profile`                                                                                                                 | Passed; measurements below.                                                                                                                  |
| `node node_modules/prettier/bin/prettier.cjs --write <changed-files> --plugin=prettier-plugin-tailwindcss`                             | Applied only to task-owned changed files; changed-file Prettier check passed.                                                                |
| `npm audit --json --offline`                                                                                                           | Returned an empty report; inconclusive because no current advisory lookup occurred.                                                          |
| `npm audit --json`                                                                                                                     | Exit 1: four high and one critical advisory in existing Prisma/Vitest chains.                                                                |

Some `npx` attempts failed because the system npm installation could not resolve `make-fetch-happen/lib/cache/policy.js`. Direct local Prisma/Playwright CLIs and the npm entry point above worked. A PowerShell `Get-Content` invocation also failed because its Management module was unavailable; read-only Node filesystem calls worked. These do not represent passed checks. An offline audit returned an empty report and is not treated as evidence of dependency security.

The online audit flagged `prisma`, `@prisma/config`, `deepmerge-ts`, `effect` and `vitest`. Comparing both lockfiles confirmed the affected versions were already present: 6.19.0, 6.19.0, 7.1.5, 3.18.4 and 3.2.4 respectively. No audit fix or unrelated dependency upgrade was applied. The Vitest advisory concerns its listening UI server; verification used `vitest run`. This observation does not erase the advisory or certify all usages safe.

A development launch using `node --env-file=.env .../next dev` failed when Next propagated that argument into `NODE_OPTIONS`. Launching Next normally worked; Next loads `.env` itself. The separate gameplay service accepts Node's `--env-file` normally.

The first browser rerun after session-end cleanup exceeded the 120-second scenario budget while Next cold-compiled platform, gameplay and bootstrap routes. The complete scenario budget was raised to 240 seconds to accommodate development compilation. All assertions and their 30-second individual timeouts were retained; no check was removed or softened.

A later run failed remote movement under load and exposed a real issue: timing corrections cleared held controls. Corrections now preserve held intent while focus/disconnect events still clear it, with a dedicated regression test. The server's lifetime violation counter was replaced by a replenishing budget so occasional delayed bursts do not accumulate forever; sustained invalid traffic is still rejected/disconnected. Another run completed gameplay but failed a socket-count assertion that included abandoned development connections. The test now checks closure of the socket that actually received the authoritative welcome. Failed attempts are retained in this account rather than described as passes.

A subsequent run passed every gameplay/navigation assertion but caught an unhandled timeout from the finite leave request. Leaving now handles that failure, relying on the already-sent gameplay leave and server grace/lease cleanup, and clears its request timer. The added regression initially exposed a retained timeout timer; explicit timer cleanup fixed it. The focused client command `node node_modules/vitest/vitest.mjs run src/game/client/network.test.ts src/game/client/runtime.test.ts --maxWorkers=1 --no-file-parallelism` then passed all three tests. A full lint rerun also fixed an unused test-handler parameter warning without changing behavior.

## Automated coverage

Nine new Vitest files cover shared protocol/configuration, fixed stepping, movement, prediction, interpolation, client correction/terminal cleanup, authoritative match/weapon behavior, actual WebSockets, network-condition simulations, trusted bootstrap/HTTP and durable PostgreSQL ownership. Existing Phase 1–3 tests remain in place.

- Shared tests cover strict schemas/version compatibility, token signature/expiry/audience/replay, input budgets and sequences, bounded time/prediction/snapshot buffers, acknowledgements, correction and wrapped-angle interpolation, speed/diagonal limits, gravity, jump, crouch/headroom, ramps, walls/bounds, weapon cadence/ammo/empty/reload idempotency, target occlusion and friendly-fire exclusion.
- Match/service tests cover reserved identity/slot checks, readiness/countdown, input rejection/corrections, server reload, full reconnect restoration, grace/startup expiry, lifecycle claims, stale callbacks and process epoch mismatch. Restarting the service cannot silently recreate old ammunition/state.
- Actual WebSocket integration joins two players, rejects unauthorized/expired/reused tickets and disallowed origins, observes remote movement, rate-limits fire, verifies target hits and blocked shots, completes reload, preserves ammo on reconnect and cleans up leave.
- PostgreSQL integration exercises atomic ownership, ACTIVE transition, stale-owner rejection and expired lease cleanup to ABORTED/CLOSED. Existing Phase 3 database tests also run.
- Playwright uses two independent authenticated guest contexts and real gameplay sockets. No local duplicated simulation or test-only gameplay authority is used.

## Browser observations and manual distinction

The final expanded browser scenario passed in approximately 1.2 minutes: room create/join, both Ready buttons and host Start, identical match IDs, distinct player IDs, server countdown/PLAYING, pointer-lock acquisition/release, remote authoritative movement, firing/ammo/reload, jump/crouch, blur input clearing, settings/reduced motion, WebGL context loss/restoration, refresh reconnect with preserved weapon state, leave confirmation/cancellation, terminal socket closure and automatic teammate return to rooms. No page errors were observed in this final run.

Responsive overlay screenshots were captured at 375, 768, 1024 and 1440 pixels wide with no horizontal overflow. Coarse/mobile input showed the unsupported-input screen and opened zero gameplay sockets. Gameplay screenshots at 1280×720 and 1920×1080 were visually inspected for arena visibility and HUD readability.

Artifacts are under `D:\twoplayer-phase4-verification\test-results\gameplay-two-authenticated-5580c--reload-reconnect-and-leave\`: `arena-720p.png`, `arena-1080p.png`, `overlay-375.png`, `overlay-768.png`, `overlay-1024.png`, `overlay-1440.png`, and `unsupported-mobile.png`.

No hands-on human two-player session was performed. Automated pointer lock is real, but it cannot judge perceived smoothness. Audio balance, extended physical mouse use, subjective local/remote motion, true tab-background behavior across browsers, pointer-lock denial UX, and sustained GPU performance remain manual acceptance checks. Collision, blocked hits and friendly-fire rules were verified programmatically; they were not all visually demonstrated in the browser scenario. Context loss was exercised using `WEBGL_lose_context`, not a physical GPU reset.

## Performance and network measurements

Authority benchmark: 9,000 measured ticks, two players, 310 simulated seconds including warm-up. Mean tick time 0.0956 ms; p95 0.1729 ms; maximum 4.72 ms. Snapshots measured approximately 15,495 bytes/second/client at 15 messages/second. Sampled heap was approximately 19.7–29.9 MB, without a demonstrated monotonic large increase. These are benchmark observations, not a wall-clock multiplayer soak or a formal leak proof.

Transport simulation preserved ordered delivery with jitter and a brief stall, reflecting TCP behavior. It did not emulate an entire browser/network stack.

| RTT    | Jitter | Interruption | Maximum pending inputs | Maximum correction | Final error |
| ------ | ------ | ------------ | ---------------------- | ------------------ | ----------- |
| 50 ms  | 14 ms  | 250 ms       | 10                     | 0.1644 m           | 0.000112 m  |
| 100 ms | 14 ms  | 250 ms       | 10                     | 0.1644 m           | 0.000188 m  |
| 150 ms | 14 ms  | 250 ms       | 11                     | 0.2805 m           | 0.000188 m  |

Browser development diagnostics varied with machine load: one locked 720p capture reached 60 FPS / 16.7 ms, with 50 draw calls and 668 triangles. Other samples were 50 FPS / 20.1 ms and 18 FPS / 54.2 ms under load. Observed traffic was roughly 16–17.4 KB/s inbound and 3–3.7 KB/s outbound. This does not establish sustained 1080p/60 FPS. The existing Chrome automation configuration permits SwiftShader and the run was not a controlled mid-range hardware benchmark.

The final passing browser run sampled 38 FPS / 26.5 ms, 50 draw calls, 668 triangles, 49 ms ping and 50 ms snapshot age. It reported one correction with a 0.03 m maximum, approximately 18.7 KB/s inbound and 4.1 KB/s outbound. This sample likewise does not certify the 60 FPS target.

## Remaining deployment and acceptance work

Configure production auth/lobby providers, apply the additive migration, supply independent signing keys, deploy the website/client on Vercel and the gameplay process on a persistent external service with HTTPS/WSS. The lease sweep requires a scheduler with a one-minute cadence. This implementation was built/tested locally; it was not deployed to external accounts.

The service is a single process with bounded match/socket capacity. Horizontal match routing, crash recovery of live simulation and long-duration GPU/memory certification are future operations work. A service restart ends existing sessions. Procedural art and synthesized audio are documented temporary assets. Gameplay requires keyboard, mouse, pointer lock and visual aiming; menus are accessible, but full FPS accessibility is not claimed.

Future Phase 5 work can extend server-owned health, damage routing, match lifecycle and snapshots. Zombies, AI, waves, downed/revive, shops, bosses, objectives, rewards, currency, progression, PvP and friendly fire were not implemented.
