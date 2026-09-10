# Phase 1 decisions, assumptions, and deferrals

## Purpose

This is the historical decision record for the TwoPlayer foundation. It makes Phase 1 defaults visible so later work can preserve, revisit, or replace them deliberately. A decision recorded here is not evidence that its later-phase behavior has been implemented. Phase 2 decisions and superseding account/catalog choices are recorded in `docs/phase-2-decisions.md`.

## Decisions

### D-01 — Start with a single modular web application

**Decision:** Use one Next.js App Router codebase for the Vercel web experience and standard APIs. Organize it by explicit presentation, domain, configuration, persistence, service, and real-time boundaries.

**Why:** The repository was empty, and Phase 1 needs a maintainable foundation rather than operational microservices. A modular application keeps local development and deployment simple while preserving seams for genuinely different workloads.

**Consequence:** New functionality should enter the narrowest existing layer. Do not create separate services until scaling, security, runtime, or ownership requirements justify them.

### D-02 — Keep the authoritative real-time runtime external

**Decision:** Vercel does not own persistent connections, active room snapshots, presence, game ticks, movement validation, damage validation, or simulation. A separately deployed service will own them.

**Why:** These workloads need long-lived connections and stable authoritative processing. They should not depend on a serverless HTTP invocation remaining active.

**Consequence:** Deployment includes at least a web control plane, PostgreSQL, and—later—an external real-time data plane. The first playable game cannot ship until that service is selected and integrated.

### D-03 — Depend on a platform gateway, not a provider SDK

**Decision:** Define `RealtimeGateway` and JSON-safe platform contracts for room, presence, session, disconnect, and reconnect concepts. The Phase 1 `UnconfiguredRealtimeGateway` explicitly reports unavailability.

**Why:** Colyseus, Nakama, Photon, and a custom server differ in transport and SDK shape. Letting those types spread into UI or application code would make provider replacement expensive.

**Consequence:** A provider adapter must translate events, results, and failures. Provider-specific capabilities do not enter shared contracts unless they represent a real product concept.

### D-04 — Use PostgreSQL and Prisma for durable records

**Decision:** Model the minimum durable foundation—`User`, `Game`, `Room`, `RoomMember`, and `Match`—in Prisma against PostgreSQL.

**Why:** These entities are relational, require constraints, and need durable lifecycle/history support. Prisma gives the TypeScript application a clear schema and generated client.

**Consequence:** Production work still needs a migration, connection-pooling, backup, and restore policy. The Phase 1 schema is a foundation, not an instruction to persist high-frequency gameplay state.

### D-05 — Do not persist presence

**Decision:** There is no `Presence` table. Online state, transport state, heartbeats, and reconnect leases belong to the real-time/session layer.

**Why:** Presence is transient and write-heavy; relational persistence creates stale records and turns the database into an unsuitable heartbeat channel.

**Consequence:** Product features that need “online players” must query/subscribe to the future presence owner and define privacy, timeout, and degraded-mode behavior.

### D-06 — Keep domain contracts independent

**Decision:** Domain types and Zod invariants do not import React, Next.js, Prisma-generated models, or vendor SDKs.

**Why:** They must be reusable by web services, tests, and a future real-time adapter without pulling framework/runtime dependencies across the boundary.

**Consequence:** Mapping between persistence rows, transport messages, and domain objects is explicit. A small amount of translation is preferred over accidental coupling.

### D-07 — Validate configuration lazily and split public/server values

**Decision:** `NEXT_PUBLIC_APP_URL` is parsed independently as public configuration. Database, real-time, and observability settings are parsed as server-only grouped configuration when a server request/service actually needs them.

**Why:** Client bundles must not expose secrets, and builds should not require live production credentials. Lazy validation still gives runtime consumers typed, early failures.

**Consequence:** `DATABASE_URL` is required for database commands and healthy server configuration but not merely to import or statically compile the application. Only names prefixed for explicit browser exposure belong in the public module.

### D-08 — Make health output sanitized

**Decision:** `/api/health` reports service/version/time and configuration readiness, returns `503` for invalid required server configuration, and never returns environment values.

**Why:** A health endpoint is useful operationally but must not become a secret-discovery endpoint.

**Consequence:** Phase 1 health proves configuration parsing, not database connectivity or real-time availability. Deeper readiness checks need explicit timeout and dependency policies later.

### D-09 — Use strict TypeScript and explicit quality gates

**Decision:** Enable strict TypeScript plus unchecked-index and exact-optional-property checking. Use ESLint, Prettier, Vitest, Testing Library, Prisma validation/generation, and a production build as quality gates.

**Why:** Strong static contracts are particularly valuable at database, configuration, UI, and provider boundaries.

**Consequence:** External/optional data must be narrowed instead of asserted. Focused tests cover important Phase 1 invariants and interactive semantics; coverage thresholds are deferred until application behavior grows.

### D-10 — Use semantic, dark-first design tokens

**Decision:** Components consume semantic roles such as background, surface, foreground, primary, accent, border, success, warning, destructive, and focus ring rather than embedding raw palette values.

**Why:** Semantic roles keep contrast and theming consistent, support future brand tuning, and prevent each feature from inventing a visual language.

**Consequence:** Raw color values belong in the token layer. Feature components should compose primitives and tokens rather than duplicating interaction CSS.

### D-11 — Use accessible headless primitives and one icon family

**Decision:** Use native controls where they suffice, Radix UI for behavior-heavy primitives, and Lucide SVG icons. Structural/navigation icons are not emojis.

**Why:** Dialog, tabs, select, and tooltip behavior require reliable focus and keyboard semantics. One icon family produces a coherent product surface.

**Consequence:** Wrappers still require accessible names, labels, disabled/loading semantics, and visual testing. A headless library is not an accessibility waiver.

### D-12 — Treat the showcase as internal foundation UI

**Decision:** `/design-system` demonstrates tokens and primitives, and `/` redirects there for Phase 1.

**Why:** An isolated preview makes interaction and responsive review possible before product flows exist.

**Consequence:** Showcase copy and controls are examples only. Phase 2 replaced the root redirect with the real discovery home while keeping `/design-system` as an internal reference; it is still not a lobby, room workflow, or game.

### D-13 — Provide framework-level state conventions now

**Decision:** Add application loading, route error, global error, and not-found surfaces using stable skeletons, safe copy, retry actions, and clear navigation.

**Why:** Feature work otherwise invents inconsistent failure behavior under deadline pressure.

**Consequence:** Later features can add local states but should retain the same feedback vocabulary and avoid leaking raw errors.

### D-14 — Use Next.js's supported Webpack compiler for Phase 1

**Decision:** Development and production scripts select Next.js's Webpack compiler explicitly.

**Why:** It provides one deterministic compiler path for the current local and deployment checks while preserving all App Router behavior.

**Consequence:** This is a build-tool choice, not an application boundary. Turbopack can be reevaluated later with the same source code after its environment compatibility is verified.

## Phase 1 assumptions and defaults

- The repository had no pre-existing application stack or Git repository; the Phase 1 stack could be selected without replacing user code.
- npm is the package manager and one npm lockfile is authoritative.
- Node.js 20.19 or newer is available in development and CI; the manifest records npm 11.18.0.
- PostgreSQL is the first durable data store.
- `DATABASE_URL` is required when database tooling or server health configuration is evaluated.
- `NEXT_PUBLIC_APP_URL` defaults to `http://localhost:3000`.
- `REALTIME_PROVIDER` defaults to the free-form identifier `unconfigured`; Phase 1 does not choose a vendor.
- Blank optional environment strings are treated as absent.
- Room codes are uppercase alphanumeric values between 6 and 12 characters.
- The shared room-foundation capacity validator accepts 2–4 players; this preserves the first game's two-player design while leaving a narrow four-player extension. No Phase 1 room command invokes it yet, and the database column has no range check.
- Presence and active simulation are transient, even when related room and match lifecycle records are durable.
- Timestamp strings cross the provider-neutral transport boundary by ISO 8601 convention; `IsoDateString` is not yet branded or runtime-validated. Application/database layers may use native date representations internally.
- The product is dark-first. A separate light theme is not a Phase 1 requirement.
- Persian text uses a Persian-capable font fallback and the layout can inherit direction; complete RTL product-flow validation remains later work.
- The design-system showcase is a development/internal route. Its production exposure policy can be decided with the product release model.

## Explicitly deferred decisions

### Identity and authorization

- Authentication provider and account lifecycle
- Username reservation/change policy
- Roles, bans, moderation, and audit logs
- Room, match, and administrative authorization rules

### Database operations

- Managed PostgreSQL vendor and regions
- Prisma migration promotion and rollback workflow
- Connection pooling/proxy strategy for Vercel
- Seeding, backups, retention, restore drills, and disaster recovery
- Data deletion/export and privacy policy

### Real-time platform

- Provider selection and commercial plan
- Direct provider SDK versus protocol adapter in the browser
- Region selection, room allocation, and horizontal scaling
- Token issuance/rotation/revocation and service-to-service authentication
- Message schema versioning and compatibility window
- Reconnect grace period, host migration, and duplicate-session policy
- Durable/live reconciliation and idempotent match callbacks

### Product behavior

- Discovery ranking and online-player privacy
- Public/private room creation and invitation flows
- Matchmaking criteria and cancellation
- Chat and voice providers and moderation
- Game rules, networking model, tick rate, lag compensation, and anti-cheat
- Progression, statistics, cosmetics, results, and monetization

### Operations and quality

- Observability provider, tracing propagation, sampling, dashboards, alerts, and SLOs
- Rate limiting, WAF rules, abuse detection, and incident response
- Browser/device support matrix and performance budgets
- End-to-end, load, soak, failover, and gameplay determinism testing
- Localization workflow and comprehensive RTL testing

## Historical risks identified before Phase 2 implementation

| Risk                                        | Why it matters                                                   | Required next decision/evidence                                                                      |
| ------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Provider capabilities diverge               | Session/reconnect/room semantics differ across vendors.          | Run a short proof of concept against the gateway contract and document gaps.                         |
| Durable and live room state diverge         | Partial failures can leave stale membership or match status.     | Define authority per field, idempotency keys, versions, and reconciliation jobs.                     |
| Serverless database saturation              | Unpooled connections can exhaust PostgreSQL under burst traffic. | Select a compatible pooler and test concurrency from the target Vercel region.                       |
| Cross-region latency                        | Web, database, and game sessions may be placed far apart.        | Establish player regions, latency targets, and data residency constraints.                           |
| Token leakage or replay                     | Real-time connection tokens cross service boundaries.            | Specify short TTLs, scopes, audience, rotation, revocation, and replay controls.                     |
| Room-code enumeration                       | Short public codes may be guessed or abused.                     | Add rate limits, expiry, authorization, and privacy-aware error responses.                           |
| Reconnect ambiguity                         | Two connections may claim one player or host role.               | Define leases, grace windows, takeover rules, and deterministic resolution.                          |
| Schema assumptions harden too early         | Statistics/progression designs may not fit premature tables.     | Add future tables only after gameplay and product requirements are stable.                           |
| Accessibility regresses in composed screens | Primitive compliance does not guarantee feature compliance.      | Include keyboard, screen-reader, contrast, motion, RTL, and responsive review in feature acceptance. |
| Showcase ships as product UI                | Examples may imply workflows that do not exist.                  | Keep it labeled internal and replace the root redirect when a real landing page is scoped.           |

## Scope confirmation

Phase 1 implements architecture, contracts, models, configuration, error/loading foundations, and reusable visual primitives only. It implements no authentication flow, user registration, presence behavior, room creation/join behavior, invitation, matchmaking, chat, voice, game rendering, movement, weapons, enemies, waves, bosses, shop, results, progression, cosmetics, moderation workflow, or monetization.
