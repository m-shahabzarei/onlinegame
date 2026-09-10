# Phase 4: first-person training slice

Vercel hosts the website and game client. The authoritative gameplay server requires a persistent external runtime. Phase 4 does not include zombies or waves.

## Runtime boundaries

`src/app/play/[matchId]` is outside the platform shell. Its Server Component checks the current Phase 2 user/guest session and Phase 3 membership. `GameShell` imports the heavy game runtime asynchronously after checking desktop input support. Three.js, Rapier and the game loop are absent from the platform route bundles.

`src/game/client` separates input, networking, rendering, audio and orchestration. `src/game/shared` contains protocol schemas, arena colliders, physics, movement/weapon configuration, time, prediction, interpolation and settings. Node-only signing code lives in `shared/tokens.ts`; the client never imports it. Per-frame transforms stay in mutable engine objects. React receives a sampled HUD at 10 Hz. Three.js runs directly inside that engine instead of adding a second React scene lifecycle.

`services/game-server` is an independent Node process with HTTP control/health endpoints and a native `ws` server. It creates one Rapier world per match, simulates both players and emits authoritative state. It never starts Next.js or opens a database connection. Lobby Ably/Redis subscriptions remain separate from gameplay WebSockets.

## Reservation and identity

1. Existing lobby readiness and host Start reserve the Phase 3 match. The lobby now routes both members to `/play/[matchId]`; old `/rooms/[code]/prepare` links still resolve through the lobby and forward to play.
2. A same-origin authenticated POST to `/api/gameplay/[matchId]`, with `{ "action": "bootstrap" }`, verifies session expiry/kind and active membership. It fetches the external server's process epoch and atomically claims the reservation as `IN_MATCH`. Two trusted identities receive immutable, separate slots and opaque gameplay IDs.
3. Next sends a signed, 30-second control envelope to the persistent service. The service checks its process epoch and provisions that exact reservation idempotently.
4. Next issues a fresh 30-second join ticket, capped by the session expiry. It contains protocol, audience, identity kind, user ID, opaque player ID, room, match, runtime and reserved slot. Only the ticket and public socket URL reach the client; session cookies and database/provider credentials do not.
5. The browser sends the ticket in its first WebSocket message. It is never a URL parameter, stored preference or log field. HMAC-SHA256 verification checks the signed bytes before strict Zod parsing. A bounded expiry-indexed replay guard consumes the nonce once. Live duplicate slots are rejected.
6. Welcome returns map/version, simulation configuration, slot, opaque player ID, match ID and a complete authoritative snapshot. After initialization/shader compilation, each client reports scene readiness. Only two connected, ready players unlock the shared countdown and authoritative PLAYING state.

These are compact signed envelopes, not JWTs. Join and control secrets should be different high-entropy values. TLS protects both public gameplay and trusted service control/callback traffic in production.

## Lifecycle and durability

States: BOOTSTRAPPING → WAITING_FOR_PLAYERS → LOADING → COUNTDOWN → PLAYING. Connection loss during play enters RECONNECTING; reconnect plus readiness returns to PLAYING. Terminal states are CANCELLED, ENDED and ERROR. Leaving is a session end, without victory, defeat, rewards or results.

Prisma's existing PENDING/ACTIVE/ABORTED statuses remain the durable lifecycle vocabulary. One additive nullable `Match.gameplay` JSON column stores the reservation, process epoch, lifecycle state and ownership lease. Snapshots, transforms, target health and ammunition are never persisted. Lifecycle callbacks are ordered by issuance time and runtime identity; duplicate/older callbacks do not extend leases. Lease renewal is a control-plane heartbeat, every ten seconds, with a 45-second expiry; it is not gameplay persistence.

The Phase 3 correction is intentionally small: `IN_MATCH` rooms are protected from lobby presence eviction and are included in current-room membership lookup. A new gameplay lease owns their disconnect policy. Failed provisioning aborts the reservation. Expired ownership closes it on access and through `/api/gameplay/sweep`; unclaimed starting reservations expire after 90 seconds. The repository's `vercel.json` schedules the authenticated sweep every minute. Deploy on a Vercel plan supporting that cadence, or arrange an external authenticated scheduler and remove that cron entry for the alternate deployment configuration.

Every server process generates a new epoch. Old reservations cannot be recreated in a restarted process, preventing an apparent reconnect from resetting ammunition. A gameplay-server crash ends the session and requires a new reservation. Grace-period reconnect to the same healthy process preserves position, weapon state, target state and slot. This phase deliberately does not persist or recover live simulation after a process crash.

## Time, movement and networking

Defaults: 30 Hz authority and prediction, 30 input messages/second, 15 snapshots/second, 60 FPS rendering target. Tick and input rate must match; snapshot rate must divide tick rate. Rendering uses delta time, while simulation uses fixed steps. Accumulators cap catch-up to five steps. Browser heartbeat and timeout timers do not depend on animation frames. Hidden tabs release controls and suspend rendering; the server continues with neutral input. Visibility return resets the accumulator.

Protocol v1 uses strict discriminated Zod schemas on every received server-bound message. Messages carry version, input/shot sequence and simulation ticks. Client messages: join, clientReady, playerInput, fire, reload, leaveMatch and ping. Server messages: welcome, matchState, worldSnapshot, movementCorrection, shotConfirmed, shotRejected, weaponState, connectionWarning, serverError and pong. Shot confirmation includes the authoritative impact; snapshot membership replaces separate spawn/remove messages. JSON is used deliberately: measured two-player snapshots cost about 15.5 KB/s per client, without compression. No private user identifiers appear in world snapshots.

Authority accepts movement intent only. Capsule motion shares Rapier's kinematic character controller and static map with prediction. It validates input sequence/tick windows, rate and queue capacity, caps vector acceleration and speed, normalizes diagonals, applies gravity and ground/jump/crouch/sprint constraints, checks standing headroom, slides along walls and traverses the ramp. Invalid/out-of-bounds positions use a safe spawn. Teammates are non-blocking; remote collision does not depend on a delayed interpolation timeline.

Prediction keeps at most 180 pending inputs. Snapshots acknowledge processed sequences; reconciliation restores authoritative motion, removes acknowledged input and replays the rest against shared geometry. Small residual differences decay over 100 ms; errors of 1.5 m or more hard-correct. Explicit timing/queue corrections discard queued intent and rebase sequence/tick in place, preventing server stalls from creating reconnect loops. A serious correction is never concealed with unlimited smoothing.

Timing rebases retain currently held controls; blur, visibility loss and disconnect still clear them. Invalid commands remain rejected individually. A replenishing violation budget disconnects sustained floods while allowing occasional delayed transport bursts to recover, instead of accumulating a lifetime violation count.

Remote snapshots are bounded to 32 entries and rendered 100 ms behind estimated server time. Positions and wrapped angles interpolate; extrapolation is horizontal, capped at 100 ms, and stops for disconnected players. Large discontinuities teleport cleanly. The procedural teammate communicates stance, grounded/moving/sprinting/firing state, aim and a name/connection label.

## Combat and presentation

One AR-01 automatic rifle: 30-round magazine, 120 reserve rounds, 150 ms minimum fire interval, 1.8-second reload, 65 m range and 25 damage to static training plates. The server validates match readiness, command order, sane angles, cadence, ammunition, reload and time windows. It derives the eye origin from authoritative motion, generates spread, raycasts solid geometry and only then applies allowed target damage. Players are filtered out of damage, and health remains at the configured default. No client-supplied hit, position, damage, health or ammunition field is accepted.

Firing cannot interrupt reload. Repeated reload requests cannot extend the deadline or duplicate rounds; completion and ammo transfer occur on the server. The client predicts muzzle/recoil feedback immediately but shows hit markers only for an authoritative target confirmation. Destroyed static plates restore health after five seconds. They never move, attack, navigate, spawn waves or grant anything.

Arena geometry, labels, weapon and teammate are locally generated temporary assets. A separate collider map defines the floor, boundaries, cover, headroom beam, ramp and targets. Shared render buffers/materials, frustum culling, two static lights, a 1.5 DPR cap and pooled tracers/impacts limit cost. No post-processing, dynamic shadows or downloaded art is used. WebGL context loss releases input; Three.js restoration retains the network session and returns to explicit entry.

Audio uses synthesized temporary Web Audio tones for local/positional remote fire, reload, dry fire and impacts. Audio starts only after a gesture. Master volume is persisted with validated local settings. Leaving closes the context, nodes and sources. Camera motion, shake, screen flashes, sensitivity, vertical inversion and FOV are configurable; settings never affect authoritative rules or rebuild the connection.

## Operations and security limits

- Deploy one persistent process for this slice, up to 100 bounded match instances / 240 connections. Multiple independent replicas behind random routing are unsupported. Add a match-to-process allocator before horizontal scaling.
- Allow only configured exact web origins. The upgrade route is `/gameplay`; tickets are first-frame credentials with a five-second handshake deadline. Production needs a reverse proxy/platform that terminates TLS and forwards WebSocket upgrades.
- Payload limit: 4096 bytes. Frame, command, input and fire budgets reject floods; slow peers exceeding the bounded send queue are disconnected. Global admission is bounded. Configure edge-level connection controls at deployment as well.
- Logs contain aggregated rejection codes and simulation overrun counts, never tokens, cookies, room codes, addresses or raw frames. HTTP responses expose sanitized typed failures.
- Reconnect retries use jittered 0.5/1/2/4/8/8-second delays with six attempts. Terminal failure has manual retry and a return route. An expired/cancelled match offers return to rooms; it never silently starts a replacement match.
- Explicit Leave sends the gameplay command and calls the authenticated web boundary. A terminal match message immediately closes the gameplay socket and heartbeat; the remaining player sees the reason and returns to rooms after ten seconds (or immediately through the return link). Route teardown disposes all remaining resources. Refresh/unexpected navigation closes the socket and uses server grace/lease cleanup.

## Accessibility and scope limits

Menus use existing semantic colors, typography, Lucide icons, Radix focus-trapped dialogs, labeled fields and visible focus. Status includes text and accessible announcements. Account and OS reduced-motion preferences seed local settings. Normal browser zoom is not intercepted outside active gameplay. Keyboard/mouse, pointer lock and visual aiming are inherent FPS requirements; this is not a claim of fully accessible gameplay. Touch/mobile input receives a responsive explanation rather than touch controls.

Human hardware testing remains necessary for perceived local/remote smoothness, audio balance and a sustained 1080p GPU budget. Automated pointer-lock and WebGL checks cannot certify those subjective qualities. See the verification record for the exact observations and remaining checks.

Future Phase 5 integration can consume authoritative health, target/damage routing, match lifecycle and snapshot extension points. AI, waves, revive, combat enemies and progression are deliberately absent. Protocol changes require a version increment and coordinated web/server release.

## API references checked

- Installed `node_modules/next/dist/docs`: Server/Client Components, dynamic route parameters, Route Handlers and lazy loading (Next 16.3.4).
- Three.js 0.185.1 renderer implementation and installed type declarations; [WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html).
- Rapier compat 0.20.0 `dist` declarations, including capsule movement, query filtering, ray hits and initialization; [character controller guide](https://rapier.rs/docs/user_guides/javascript/character_controller/).
- ws 8.21.3 installed README and declarations; [upgrades, authentication, limits and heartbeat patterns](https://github.com/websockets/ws).
- Playwright 1.63.0 declarations and [BrowserContext API](https://playwright.dev/docs/api/class-browsercontext).
