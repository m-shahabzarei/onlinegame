# Navigation, Solo Mode, and Bilingual Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make navigation responsive, add a server-validated solo Nightfall Protocol mode, and provide typed English/Persian localization with local Persian fonts.

**Architecture:** Extend the existing App Router, lobby domain, gameplay reservation, and WebSocket match state in place. Add a small request-scoped i18n resolver and client language switcher without locale-prefixed routes. Keep the persistent game server authoritative and preserve the Vercel/server boundary.

**Tech Stack:** Next.js 16.3.4 App Router, React 19, TypeScript, Zod, Prisma, WebSocket server, Vitest, Playwright, next/font/local.

## Global Constraints

- Preserve shared layouts and the separate authoritative Node/WebSocket gameplay server.
- Never expose server secrets or server-only environment variables to client bundles.
- Keep co-op behavior compatible and avoid new dependencies.
- Use local Vazir/Vazirmatn assets only for Persian.
- Keep user-facing strings behind typed translation keys in touched surfaces.

---

### Task 1: Typed locale resolution and fonts

**Files:** Create `src/i18n/index.ts`, `src/i18n/messages.ts`; modify `src/app/layout.tsx`, `src/app/globals.css`, settings action/form.

- [ ] Add `Locale = "en" | "fa"`, key-safe `translate(locale,key)`, and resolution order (user preference, cookie, fallback).
- [ ] Load local Persian fonts through `next/font/local`; set `lang`, `dir`, and a locale data attribute in the root layout.
- [ ] Persist guest selection in a cookie and authenticated selection through the existing settings action.
- [ ] Add tests for fallback, persistence, attributes, and missing keys.

### Task 2: Navigation feedback and route loading

**Files:** Create missing route `loading.tsx` files and `src/components/navigation/route-progress.tsx`; modify `src/app/layout.tsx`, `src/components/app/app-shell.tsx`, affected links.

- [ ] Add meaningful skeletons for dynamic room, prepare, profile, settings, and gameplay routes.
- [ ] Replace raw internal anchors and duplicate transitions with `Link`/single router transitions while retaining logout refresh.
- [ ] Add a lightweight `useLinkStatus` pending indicator and performance marks for client transitions.
- [ ] Add navigation tests and document a repeatable Playwright timing measurement.

### Task 3: Explicit solo/coop lobby mode

**Files:** Modify `src/domain/lobby.ts`, `src/server/lobby/room-service.ts`, `src/server/lobby/store.ts`, Prisma persistence, room browser/lobby UI.

- [ ] Add typed `GameMode` and include it in create commands, room aggregates, snapshots, and persistence JSON.
- [ ] Allow solo rooms to start with one connected ready host; keep co-op requiring two.
- [ ] Add Play Solo/Play Co-op actions and mode-aware blockers/copy.
- [ ] Validate mode server-side and add unit/integration tests for creation, readiness, start, and invalid mutation.

### Task 4: Authoritative solo gameplay

**Files:** Modify `src/game/shared/protocol.ts`, `src/server/gameplay/service.ts`, `services/game-server/match.ts`, PvE simulation/revive logic and fixtures.

- [ ] Represent solo reservations with one participant while accepting legacy two-player tuples.
- [ ] Gate bootstrap, join, readiness, reconnect, revive, defeat, and victory by the reservation mode and player count.
- [ ] Use deterministic solo defeat/reconnect behavior and config-driven solo balancing without changing co-op defaults.
- [ ] Add server tests for bootstrap, waves, victory/defeat, reconnect, and mode tampering.

### Task 5: End-to-end and documentation verification

**Files:** Modify `e2e/pve.spec.ts`, focused tests, `README.md`, create `docs/solo-and-locales.md`.

- [ ] Add one-browser solo flow coverage and retain two-browser co-op coverage.
- [ ] Run formatter, lint, typecheck, unit/integration, game build, Next production build, and Playwright.
- [ ] Record navigation timings before/after and document locale selection, fonts, migrations, and limitations.
