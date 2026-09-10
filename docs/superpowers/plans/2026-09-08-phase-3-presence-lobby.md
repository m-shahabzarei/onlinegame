# Phase 3 Presence, Lobby, and Rooms Implementation Plan

**Goal:** Two authenticated users or validated guests can share a room, ready up, and reserve a preparation session without gameplay.

**Architecture:** Extend the Phase 1 realtime boundary with focused application interfaces. PostgreSQL owns room aggregates and pending Match records; Ably carries invalidations only; expiring Redis leases own presence and abuse limits. Explicit local adapters support development without cloud credentials. Execute inline; do not commit.

**Tech Stack:** Next.js 16.3.4 App Router, React 19.2.8, Prisma 6.19/PostgreSQL, npm 11.18, existing Zod, Radix, Lucide, Tailwind, Vitest. No new dependencies.

## Constraints and preflight

- Preserve existing files; this directory has no .git metadata. A SHA256 baseline is stored outside the project.
- Current local Next.js route-handler, page, and server/client documentation read before implementation.
- Existing cookie auth includes database and development modes; guests are real server-issued sessions.
- Existing room/member/match models and enums are retained. No persisted heartbeat records or gameplay tables.
- docs/design-system.md and globals.css are the persisted visual source; no MASTER.md or page overrides exist.
- Tests use Vitest/Testing Library; no configured Playwright. Browser QA will use available tooling where possible.
- No Phase 4 systems, chat, voice, friends, matchmaking, or commits.

## Execution checklist

- [x] Domain and storage: add lobby DTOs, strict command schemas, typed errors, secure code utility, aggregate state transitions, atomic RoomStateStore adapters, minimal additive SQL migration. Test capacity, authorization, stale versions, expiration, collision and duplicate handling.
- [x] Session lifecycle: PresenceService, Redis REST/local ephemeral stores, TTL and deterministic grace-period host transfer. Test two identities, duplicate tabs, disconnect, reconnect, stale readiness, and failure rollback.
- [x] Realtime: extend src/realtime with RealtimePublisher/Subscriber and ConnectionManager. Ably REST publish/subscribe-only short-lived token adapter, direct provider SSE client, local refresh adapter. Test invalidations and version reconciliation.
- [x] HTTP boundary: session verification, strict same-origin JSON mutations, bounded bodies, identity/network rate limits, correlation IDs, safe error mapping. Expose rooms, presence, heartbeat, and subscription operations under /api/lobby.
- [x] UI: /games/[slug]/rooms, /rooms/[code], /rooms/[code]/prepare. Reuse buttons, inputs, dialogs, avatars, cards, tokens. Add explicit join, create, invite copy, ready, host confirmations, connection banner, reservation cancellation, and all recoverable states.
- [x] Integration: activate first-game preparation access, add genuine aggregate presence to shared shell and update Phase 2 availability copy.
- [x] Verification: baseline/full Vitest, Prisma validation/generation, Next typegen, TypeScript, ESLint, build, browser responsiveness at 375/768/1024/1440, and two-client service/realtime scenarios. Record commands and limitations.
- [x] Operations documentation: state ownership, provider setup, migration/baselining, expiry on access, refresh fallback, TTLs, security, local-only limitations, and changed-file manifest.
