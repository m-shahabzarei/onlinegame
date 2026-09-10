# Phase 3 verification — 8 September 2026

The final automated suite passed **159 tests in 27 files**, including real PostgreSQL tests. No Playwright dependency or E2E configuration existed; browser verification used two independent loopback cookie identities through the available browser tooling. No dependency was added and no commit was made.

## Environment and preservation

- Workspace: `D:\shahab\work\work project\2Player`.
- Next.js 16.3.4, React 19.2.8, Prisma 6.19.0, Node 20.20.2, npm 11.18.0.
- Existing `node_modules` and `.next` are junctions to C:. Webpack in the D: checkout resolves malformed cross-drive module paths. Those user junctions were preserved.
- Source verification copy: `C:\Users\FaraPardaz\.codex\visualizations\2026\09\08\01a08057-1549-78c2-8941-8c584940a18c\phase3-preview`, with dependencies on the same drive. It contains the same application sources.
- Database checks used an isolated Docker PostgreSQL 16 instance, bound only to `127.0.0.1:15433`. Test database: `phase3_test`; migration preservation database: `phase3_migration_test`. No production connection was used.
- A pre-edit SHA256 manifest was compared against the workspace. No baseline file was deleted; `package.json` and `package-lock.json` remain unchanged. The repository has no `.git` metadata, so existing user changes could not be classified by Git.

## Commands and results

Repeated identical commands are grouped here; earlier failures and their resolutions are retained. `$testUrl` denotes the disposable `phase3_test` connection, `$migrationUrl` the disposable `phase3_migration_test` connection, `$preview` the C: copy above, and `$phase2Schema` the temporary original schema used to test the additive migration. These are explanatory aliases, not required application environment variables.

| Verification command                                                                                                                         | Result                                                                                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test` before implementation                                                                                                             | Passed: 86 baseline tests.                                                                                                                                                      |
| `npm run db:format`                                                                                                                          | Passed; formatted the minimally extended schema.                                                                                                                                |
| `npm run db:generate`                                                                                                                        | Passed; generated Prisma Client 6.19.0. Also runs as part of build.                                                                                                             |
| `npm run typegen`                                                                                                                            | Passed; generated types for the new routes.                                                                                                                                     |
| `npm run typecheck`                                                                                                                          | Early runs found stale route types; running typegen resolved them. A later new test used unsupported Testing Library `exact`; removed that option. Final result recorded below. |
| `npm run lint`                                                                                                                               | Early runs found a render-time ref read and synchronous effect updates; fixed. Later full runs passed. Final result recorded below.                                             |
| `npm test -- src/server/lobby src/domain/lobby.test.ts src/realtime`                                                                         | Passed: 61 domain, service, API, and provider tests at that stage.                                                                                                              |
| `npm test` after implementation                                                                                                              | An intermediate full run passed 147 tests with 2 database tests skipped. Initial catalog-copy expectation mismatches were updated to the new availability text.                 |
| `npm test -- src/server/lobby/prisma-store.integration.test.ts` with `LOBBY_TEST_DATABASE_URL`                                               | An initial concurrent verification attempt hit resource exhaustion. Retried serially below.                                                                                     |
| `npm test -- src/server/lobby/prisma-store.integration.test.ts --maxWorkers=1 --no-file-parallelism` with `LOBBY_TEST_DATABASE_URL=$testUrl` | Passed: 2 real PostgreSQL integration tests.                                                                                                                                    |
| `npm test -- src/components/lobby/room-lobby.test.tsx`                                                                                       | Initial run during simultaneous builds/tests hit Node allocation failure. Retried serially below.                                                                               |
| `npm test -- src/components/lobby/room-lobby.test.tsx --maxWorkers=1 --no-file-parallelism`                                                  | Passed: 6 lobby interaction/accessibility tests.                                                                                                                                |
| `npm test -- --maxWorkers=1 --no-file-parallelism` with `LOBBY_TEST_DATABASE_URL=$testUrl`                                                   | Passed first with 155 tests, then **159 tests / 27 files / 0 skipped**, after adding origin, migrated-room, and browser recovery coverage. Final full run: 106.82 seconds.      |
| `npm run build` in D: workspace                                                                                                              | Failed on pre-existing cross-drive Webpack module resolution (`./C:/Users/.../next/dist/client/app-next.js`).                                                                   |
| `npm run build` in C: source copy, without database environment                                                                              | Compilation and TypeScript passed; prerendering `/profile` failed because database authentication requires `DATABASE_URL`. Retried with isolated database configuration below.  |
| `npm run dev -- --port 3100` with `AUTH_MODE=development`, `REALTIME_PROVIDER=local`, empty `DATABASE_URL`, and loopback app URL             | D: startup exposed the cross-drive dependency problem. C: preview served the room flows successfully. Stopped the task-owned dev server after browser QA.                       |
| `npx prettier --write <created/modified TS, TSX, MD and JSON files>`                                                                         | Passed; formatting was limited to files identified by the pre-edit manifest. Later edited files were formatted again.                                                           |

Database verification commands, in execution order:

```powershell
docker info --format '{{.ServerVersion}}'
docker run --rm --detach --name twoplayer-phase3-test --publish 127.0.0.1:15433:5432 --env POSTGRES_PASSWORD=local-phase3-only --env POSTGRES_DB=phase3_test postgres:16
docker exec twoplayer-phase3-test pg_isready -U postgres
$env:DATABASE_URL = $testUrl
npx --no-install prisma db push --skip-generate --schema $phase2Schema
npx --no-install prisma db execute --file prisma/migrations/20260908000000_phase3_lobby/migration.sql --schema prisma/schema.prisma
npm run db:validate
npx --no-install prisma migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma/schema.prisma --exit-code
```

All passed. The original Phase 2 schema was applied first, then the additive Phase 3 migration. Prisma reported **no schema difference** afterward. The password shown is only for this disposable local test fixture.

The repository had no migration history. A baseline was generated from the original schema using Prisma's `migrate diff --from-empty --to-schema-datamodel ... --script`. On a separate disposable database, the baseline SQL was applied, a `migration-sentinel` user was inserted, the baseline was marked applied with `prisma migrate resolve --applied 20260907000000_phase2_baseline`, and `prisma migrate deploy` applied Phase 3. A SQL check confirmed the sentinel remained. All steps passed without resetting a database or deleting existing data.

## Test coverage

- `src/domain/lobby.test.ts`: cryptographic code format/randomness, normalization, invalid input, strict command schemas, typed error mapping, deterministic host tie-breaks, and stale revision/observation reconciliation.
- `src/server/lobby/room-service.test.ts`: 32 service scenarios including create/join/leave/ready/kick/close, public/private visibility, capacity, duplicate membership, incompatible rooms, host authorization, idempotency, expired/closed/invalid invites, two-client notifications, reservation rollback/cancellation, grace-period disconnect/reconnect/host transfer, stale commands, and migrated rooms without receipts.
- `src/server/lobby/prisma-store.integration.test.ts`: real serializable last-slot competition, concurrent duplicate start producing one reservation, host departure aborting that reservation, and atomic rollback when host membership cannot persist.
- `src/server/lobby/http.test.ts`: 11 API/security cases covering validated identities, strict inputs, body bounds, origin checks including loopback development, rate limiting, safe failures, and correlation IDs.
- `src/server/lobby/ephemeral.test.ts`: TTL presence, identity deduplication, Redis REST lease/limit commands, and rate-limit behavior.
- `src/realtime/ably-server.test.ts`: opaque publish payloads, subscribe-only capabilities, bounded token lifetime, and expired-session rejection using a REST test double.
- `src/realtime/connection-manager.test.ts`: scoped subscriptions, bounded retry/failure, recovery snapshots, and timer/subscription cleanup.
- `src/components/lobby/room-lobby.test.tsx`: readiness gating, preparation routing, failure reconciliation, guest/host controls, confirmation focus/Escape, reconnect gating, and copy feedback.
- `src/components/lobby/room-browser.test.tsx`: disconnected command gating, preserved code input, and retry using the original idempotency key.
- Existing catalog, home, environment, and game-card tests were updated for the actual Phase 3 capabilities; other baseline tests were retained.

## Browser verification

The two independent guest cookie jars used `localhost:3100` and `127.0.0.1:3100`. Local subscriptions use the documented four-second snapshot adapter; these observations do not claim a live Ably cloud test.

Verified through the UI:

1. Signed-out entry offers sign-in or a server-issued guest session and preserves the destination.
2. A guest creates a public room; the host starts Not Ready with one empty slot and a disabled Start button.
3. The room appears for a second guest in public discovery with real occupancy and presence counts.
4. The second guest joins using a lowercase, hyphenated code. Both clients show two members without a page reload.
5. The host becomes Ready; Start remains disabled until the second guest is also Ready.
6. Starting navigates both guests to `/rooms/[code]/prepare` and explicitly states that gameplay belongs to Phase 4.
7. Confirmation initially focuses the safe action; cancellation returns both users to WAITING with readiness reset.
8. A browser refresh restores the latest room membership and state.
9. Intentional host leave makes the remaining guest host and displays the host-transfer notification.
10. Copy invite link gives visible success feedback on mobile. Closing shows the closed-room recovery screen.

Responsive lobby measurements (actual browser `innerWidth`, not merely requested viewport size):

| Viewport    | Document scroll width | Visual result                                                              |
| ----------- | --------------------: | -------------------------------------------------------------------------- |
| 375 × 812   |                 360px | Stacked slots/actions, mobile navigation, readable code and copy controls. |
| 768 × 1024  |                 753px | Stacked tablet cards; controls and invite field fit.                       |
| 1024 × 900  |                1009px | Two-column lobby; invite and readiness controls fit.                       |
| 1440 × 1000 |                1425px | Centered wide layout with controlled content width.                        |

The 15px difference is the browser scrollbar. No horizontal overflow was measured. Screenshots were inspected after layout settled. The viewport override was reset afterward.

The browser renderer crashed intermittently under machine memory pressure. Extra private-create/deep-link and room-browser breakpoint checks were interrupted; those paths have service/API coverage but are **not claimed as completed browser E2E checks**. Timed disconnect/grace/reconnect and stale reconciliation are verified by deterministic automated tests; browser QA verified refresh recovery. No Playwright suite was installed or added solely for this task.

## Limits and deployment prerequisites

Ably and Redis adapters were tested against test doubles and current official API documentation, not live cloud credentials. Production requires the environment and active first-game row described in `phase-3-operations.md`. Local storage is deliberately non-production. Room expiry is reconciled on access; Redis leases expire independently.

The machine experienced transient Node OOM/allocation failures and one terminal-session loss during concurrent verification. Sequential single-worker test runs passed. The user’s unrelated processes and dependency junctions were not changed.

## Final outcomes and cleanup

| Command                                                                                                                                                                                                               | Final result                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typegen`                                                                                                                                                                                                     | Passed.                                                                                                                                                          |
| `npm run typecheck`                                                                                                                                                                                                   | Passed after removing the unsupported test-only locator option.                                                                                                  |
| `npm run lint`                                                                                                                                                                                                        | Passed, exit 0.                                                                                                                                                  |
| `npm test -- src/components/lobby/room-browser.test.tsx --maxWorkers=1 --no-file-parallelism`                                                                                                                         | Passed: 2 tests after the test-only typing correction; 6.79 seconds. The preceding full suite passed 159 tests.                                                  |
| `robocopy . $preview /E /XD node_modules .next /XF tsconfig.tsbuildinfo /NFL /NDL /NJH /NJS /NP`                                                                                                                      | Source copy refreshed successfully (Robocopy exit 1 means files copied).                                                                                         |
| `npm run build` in `$preview` with the environment below                                                                                                                                                              | **Passed, exit 0.** Webpack compilation, TypeScript, 8/8 static pages, page optimization, and build traces completed. All new routes appear in the build output. |
| `npm run format:check`                                                                                                                                                                                                | **Passed across the entire repository**, exit 0.                                                                                                                 |
| `npx prettier --write README.md docs/phase-3-operations.md docs/phase-3-verification.md docs/phase-3-files.md docs/superpowers/plans/2026-09-08-phase-3-presence-lobby.md src/components/lobby/room-browser.test.tsx` | Passed; only task-owned changes were formatted. Final documentation updates were formatted again.                                                                |
| `npx prettier --check docs/phase-3-verification.md docs/phase-3-files.md docs/superpowers/plans/2026-09-08-phase-3-presence-lobby.md`                                                                                 | Passed after final report updates.                                                                                                                               |
| SHA256 baseline/file-existence comparison using `rg --files`, `Get-FileHash`, and `Test-Path`                                                                                                                         | 43 created files, 18 modified files, 0 deleted baseline files. The full manifest is in `phase-3-files.md`.                                                       |
| `docker ps --filter name=twoplayer-phase3-test --format '{{.Names}} {{.Ports}}'` then `docker stop twoplayer-phase3-test`                                                                                             | Verified the isolated loopback test container and stopped it successfully. Its `--rm` lifecycle removes the disposable databases.                                |

Successful build environment:

```powershell
$env:DATABASE_URL = $testUrl
$env:AUTH_MODE = 'database'
$env:REALTIME_PROVIDER = 'unconfigured'
$env:NEXT_PUBLIC_APP_URL = 'http://localhost:3100'
$env:NODE_OPTIONS = '--max-old-space-size=1536'
npm run build
```

`unconfigured` permits build verification without cloud credentials and leaves realtime unavailable at runtime; it is not a production realtime configuration. Deploy with Ably/Redis variables as documented. The build's page generation used the isolated database environment only.

The preview dev server is stopped, browser viewport override was reset, and the final browser inventory contains no task tabs. The source verification copy is retained outside the repository. No unrelated user process was stopped. The only unresolved build issue is the original D: cross-drive junction setup; the same application builds successfully with dependencies on the same drive.
