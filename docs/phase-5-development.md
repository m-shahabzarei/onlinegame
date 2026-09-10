# Running Phase 5

Phase 5 contains exactly five survival waves and five archetypes: Walker, Runner, Spitter, Brute and Screamer. The starter rifle remains the only weapon. There are no shops, economy, purchases, upgrades, bosses, objectives, rewards, XP, progression, leaderboards, chat or voice chat.

## Runtime and environment

The web application and WebGL client can be hosted on Vercel. The authoritative gameplay server requires a persistent external Node runtime with WebSocket support. Do not place its fixed simulation or socket listener in Vercel Serverless Functions. The existing single-process reservation, signed join-token, origin, lease and lifecycle boundaries remain.

No new production environment variable, dependency or database migration is required. Retain the existing variables from [Phase 4 operations](phase-4-development.md): `GAMEPLAY_JOIN_SECRET`, `GAMEPLAY_CONTROL_SECRET`, `GAMEPLAY_SERVER_HTTP_URL`, `GAMEPLAY_WS_URL`, `GAMEPLAY_WEB_URL`, `GAMEPLAY_ALLOWED_ORIGINS`, optional `GAMEPLAY_HOST`/`GAMEPLAY_PORT`, simulation timing variables and `CRON_SECRET`. Existing production authentication, PostgreSQL and lobby provider configuration remains required. Both web and gameplay runtimes must deploy protocol **2** and map **2** together; drain old matches before deployment. A process restart still ends active runs.

```text
npm ci
npm run db:generate
npm run dev
```

In a second terminal:

```text
npm run game:dev
```

Use the existing explicit `AUTH_MODE=development`, `REALTIME_PROVIDER=local` and no `DATABASE_URL` for an ephemeral local session. Production rejects these development providers. Never use production credentials for test fixtures.

On this particular Windows machine the default global npm installation cannot resolve one of its own modules. The working equivalent is `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" <arguments>`. The preserved `.next` junction resolves to another drive and breaks Next runtime imports; set `TWOPLAYER_LOCAL_BUILD=1` for `.next-local` on this machine. This also keeps warmed development routes for ten minutes to avoid recompilation during two-client verification. The optional switch does not change the default Vercel output.

## Two-client play procedure

1. Open two separate browser profiles or contexts with keyboard/mouse support. Create two guest identities or sign in as two authorized players.
2. Create a private room, join by its code, ready both members and start from the host. Both clients should open the same `/play/[matchId]` reservation.
3. Wait for both scenes to load and the synchronized countdown. Click **Enter arena** in each browser. Use WASD/mouse, Shift, Space, Ctrl/C, left mouse and R. Escape opens the existing overlay; the server continues running.
4. Fight through five waves. The server validates spawns, movement, attacks and rifle head/body hits. Use the divider, crates and ramp for cover. Watch the windup rings and special-enemy text cues.
5. Let one player take lethal damage. Verify zero HP and **DOWNED**, inability to move/fire/reload, and an authoritative bleed-out countdown. The living player should approach within 2.4 m and hold **E** for five seconds.
6. Release E, move away or break LOS to cancel. Repeat the full hold; verify 45 HP and brief protection. Let a second downing bleed out, then clear the wave with the survivor; the eliminated teammate returns at the following intermission.
7. Reload or briefly interrupt one client. The remaining player can fight; reconnect must retain health, ammunition, wave, entity generations and cooldown state. If the sole living teammate is reconnecting, recovery waits only until the original grace deadline.
8. Verify both-down defeat, and in another run clear Wave 5. The terminal overlay must allow a safe return, with no Wave 6 or reward flow. Check that leaving closes sockets/audio and releases pointer lock.
9. Enable development diagnostics and inspect all five silhouettes, crowd movement, cover occlusion, headshots, special cues, down/revive/return and terminal overlays. Repeat with reduced motion/camera movement and screen flashes disabled.

The intermission rule preserves the magazine and raises the same rifle's reserve to at least 120 rounds. Returned players receive full health. Reconnect itself grants neither ammunition nor health. Player movement retains Phase 4's prediction against static geometry; zombies avoid living players but are not added as blocking client-predicted character colliders. This prevents reconnecting or downed players acting as shields and avoids divergent dynamic collision timelines.

## Automated checks and deterministic browser fixtures

```text
npm run typegen
npm run typecheck
npm run lint
npm test -- --maxWorkers=1 --no-file-parallelism
npm run test:pve
npm run game:build
npm run build
npm run db:validate
npm run game:pve:profile
```

`LOBBY_TEST_DATABASE_URL` enables the existing optional PostgreSQL integration suites and must name a disposable `phase3_test` database. No PostgreSQL per-tick writes are introduced.

`e2e/pve-harness.mjs` is an isolated test launcher, excluded from the production server build and not imported by production routes. It requires `NODE_ENV=test` and a temporary `PVE_FIXTURE_KEY` of at least 24 characters, creates ephemeral signing keys, starts Next on localhost:3100, gameplay on localhost:8080, and an authenticated loopback fixture endpoint on localhost:8092. Only this trusted harness can accelerate waves, arrange combat, apply damage or sustain 24 entities. Public gameplay clients have no fixture commands.

```powershell
$env:NODE_ENV='test'
$env:PVE_FIXTURE_KEY='<temporary random local fixture key>'
node e2e/pve-harness.mjs
```

In another terminal with the same fixture key:

```powershell
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3100'
$env:PLAYWRIGHT_EXECUTABLE_PATH='C:/Program Files/Google/Chrome/Application/chrome.exe'
$env:PVE_FIXTURE_KEY='<same temporary local fixture key>'
npm run test:e2e
```

The production defaults remain unchanged: five normal waves, 30-second bleed-out and five-second revive. Harness tuning is faster. Run browser verification without concurrent builds or CPU load; cold Next compilation must finish before starting a timed gameplay scenario. Do not enable fixture endpoints on a deployed server. Browser traces are disabled to avoid retaining authenticated transport frames.

`game:pve:profile` measures a seeded 24-zombie mixed simulation with two active players, shots, attacks, replacement enemies and snapshots. It uses trusted health/ammunition replenishment to sustain load, and reports tick/AI/navigation/rewind cost, paths, wire size and GC heap. It does not measure GPU performance or human gameplay quality. See [verification](phase-5-verification.md) for actual results and remaining manual checks.
