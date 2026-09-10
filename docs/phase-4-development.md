# Running and deploying Phase 4

## Local commands

Use Node >=20.19 and the repository's npm lockfile. Install with `npm ci`, then generate Prisma with `npm run db:generate`. For PostgreSQL mode, apply migrations with `npx prisma migrate deploy`. This adds one nullable JSON column; it does not reset data.

Copy `.env.example` to `.env`, configure the values below and run two terminals from the repository root:

```text
npm run dev
npm run game:dev
```

The first serves the website at port 3000; the second compiles and starts the persistent gameplay process at port 8080. Server changes need a restart. For local development without external infrastructure, use the existing `AUTH_MODE=development` and `REALTIME_PROVIDER=local`, and omit `DATABASE_URL` so the local catalog is selected. These modes are rejected in production.

Generate independent signing keys, without placing them in source or a URL:

```text
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Run that separately for each secret. Never copy real values into documentation or commit `.env`.

| Variable                   | Runtime                | Purpose                                                                                                           |
| -------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `GAMEPLAY_JOIN_SECRET`     | Web + gameplay server  | At least 32 characters; signs/verifies short-lived first-frame tickets.                                           |
| `GAMEPLAY_CONTROL_SECRET`  | Web + gameplay server  | Independent service-control and lifecycle callback key.                                                           |
| `GAMEPLAY_SERVER_HTTP_URL` | Web                    | Trusted persistent service base URL; HTTPS in production.                                                         |
| `GAMEPLAY_WS_URL`          | Web/bootstrap response | Public `wss://.../gameplay`; local `ws://localhost:8080/gameplay`.                                                |
| `GAMEPLAY_WEB_URL`         | Gameplay server        | Website base URL for signed lifecycle callbacks.                                                                  |
| `GAMEPLAY_ALLOWED_ORIGINS` | Gameplay server        | Comma-separated exact origins, e.g. local localhost and 127.0.0.1 on port 3000. Production origins must be HTTPS. |
| `GAMEPLAY_HOST`            | Gameplay server        | Default `127.0.0.1`; `0.0.0.0` inside deployed container.                                                         |
| `GAMEPLAY_PORT`            | Gameplay server        | Default 8080.                                                                                                     |
| `GAMEPLAY_TICK_RATE`       | Gameplay server        | Default 30; also sets prediction/input rate in welcome.                                                           |
| `GAMEPLAY_SNAPSHOT_RATE`   | Gameplay server        | Default 15; must divide tick rate.                                                                                |
| `GAMEPLAY_STARTUP_MS`      | Gameplay server        | Default 90000; bounded startup wait.                                                                              |
| `GAMEPLAY_RECONNECT_MS`    | Gameplay server        | Default 30000; bounded slot retention.                                                                            |
| `CRON_SECRET`              | Web + scheduler        | Protects `/api/gameplay/sweep`. Vercel sends it as a Bearer credential.                                           |

Existing production auth/database/Ably/Redis variables still apply; see `.env.example` and Phase 3 operations. No gameplay credentials use the `NEXT_PUBLIC_` prefix. The socket URL is returned by bootstrap instead of baked into a client build.

To verify with two players, open two independent browser contexts, create server-issued guest sessions or sign in, join one room, mark both Ready and have the host Start Game. `/play/[matchId]` opens automatically. Both clients must finish loading before countdown. Click Enter arena for pointer lock.

Controls: WASD, mouse look, Shift sprint, Space jump, Ctrl/C crouch, left mouse fire, R reload and Escape overlay. Fire at the visible amber plates; the middle plate is intentionally occluded by the divider wall. Stand under the east-side beam while crouched to exercise headroom checks. Pause/Settings does not pause the server.

## Checks

```text
npm run typegen
npm run typecheck
npm run lint
npm test -- --maxWorkers=1 --no-file-parallelism
npm run test:game
npm run build
npm run game:build
npm run db:validate
npm run game:profile
```

PostgreSQL integration tests require `LOBBY_TEST_DATABASE_URL` pointing to a disposable database named `phase3_test`. This name intentionally matches the existing Phase 3 suite. They create and remove only their fixture users/rooms and never reset a database.

Browser tests use Playwright and two real authenticated contexts. Start both local services first, install a test browser with `npx playwright install chromium`, then run `npm run test:e2e`. Optional: `PLAYWRIGHT_BASE_URL` and `PLAYWRIGHT_EXECUTABLE_PATH` select an existing local service/browser. Tests disable traces to avoid collecting session/ticket traffic; screenshots contain only gameplay/UI. The browser run must use development mode to test the opt-in diagnostics control.

`game:profile` is an authority benchmark covering 310 simulated seconds. It is not a GPU benchmark or a 310-second wall-clock human playtest. Use in-game development diagnostics for rendering, ping, snapshot age, prediction correction, input backlog and message/byte rates. Diagnostics are unavailable in production.

## Deployment

Build the web app normally for Vercel. Configure production database auth and lobby providers; run the additive migration before releasing Phase 4. The web application has only finite bootstrap/control/callback routes. It contains no gameplay WebSocket listener.

For the persistent service, build with `npm run game:build` and start with `npm run game:start`, or use:

```text
docker build -f services/game-server/Dockerfile -t twoplayer-gameplay .
```

Supply the environment via the hosting platform, terminate TLS, forward WebSocket upgrades, configure health checks against `/health`, and allow outbound HTTPS callbacks to the website. Use one process/replica for this vertical slice. Deployment/restart ends existing sessions; old process epochs cannot be resumed.

The Vercel cron configuration sweeps leases every minute. That cadence requires a supporting Vercel plan. An external scheduler can instead GET `/api/gameplay/sweep` every minute with `Authorization: Bearer <CRON_SECRET>`; in that setup omit the bundled Vercel cron entry. This is required for unattended database cleanup, including a reservation whose players never open the game route. Expiry also reconciles when a player returns.

Both web and service must deploy protocol v1 together. Serve web pages over HTTPS and sockets over WSS in production. Keep signing keys consistent between runtimes and rotate by draining old sessions before replacing both sides.

## Environment-specific verification issue

The original D: workspace uses an existing `node_modules` junction to C:. Prior Phase 3 documentation records that this arrangement breaks Webpack entry resolution. It was preserved. Phase 4 verification used an isolated D: source copy with real same-drive dependencies, where installation, tests and builds can run without changing the user's junction. During setup C: filled up and a temporary install failed; the verification record distinguishes that attempt from the successful D: install.
