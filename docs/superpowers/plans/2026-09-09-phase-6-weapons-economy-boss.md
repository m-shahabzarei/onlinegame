# Phase 6 Weapons, Economy, Objectives and Boss Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the authoritative two-player PvE run from the Phase 5 five-wave test experience to a Phase 6 ten-wave match with match-only economy, weapons, shop, map gate, objectives, mini-boss, final boss, scoreboard, and reconnect-safe snapshots.

**Architecture:** Keep gameplay authority in `services/game-server` and share validated content/protocol schemas from `src/game/shared`. Add a focused Phase 6 state model that composes with the existing `MatchInstance` and PvE simulation, preserving Phase 5 defaults through an explicit content profile. Extend snapshots and commands with revisioned, idempotent operations; render the new state through the existing HUD/GameShell design language.

**Tech Stack:** TypeScript 5.9, Zod 4, Vitest, Next.js 16 App Router, React 19, existing WebSocket/Three.js runtime.

## Global Constraints

- All Scrap, weapons, upgrades, objectives, gates, boss state, and score are match-only.
- The server is authoritative for economy, combat outcomes, progression, and match result.
- Preserve the existing Phase 5 profile and protocol behavior.
- Do not add dependencies, persistence tables, permanent progression, cosmetics, monetization, chat, or Phase 7/8 systems.
- Validate all content at startup and reject invalid costs, stats, transitions, and references.
- Keep Next.js server/client boundaries and existing design tokens.

---

### Task 1: Shared Phase 6 content and state model

**Files:**
- Create: `src/game/shared/phase6.ts`
- Modify: `src/game/shared/protocol.ts`, `src/game/shared/pve.ts`, `src/game/shared/lifecycle.ts`
- Test: `src/game/shared/phase6.test.ts`

- [ ] Add Zod schemas and registries for phase6-production/phase5-test profiles, five weapons, three upgrade levels, shop items, support items, sentry turret, gate, two objective types, mini-boss, boss phases, ten wave descriptors, scoring rules, and match-only state.
- [ ] Add pure wallet, score, contribution, purchase idempotency, upgrade resolution, gate/objective validation, boss phase, and victory-condition helpers.
- [ ] Extend protocol unions with revisioned Phase 6 client commands/server events and complete snapshot state while retaining v2 compatibility.
- [ ] Extend match lifecycle states with BOSS_INTRO, BOSS_ACTIVE, VICTORY, TEAM_DEFEATED, CANCELLED, ERROR transitions.
- [ ] Add focused unit tests for arithmetic, limits, idempotency, prerequisites, wave/boss/objective transitions, and snapshot serialization.

### Task 2: Authoritative Phase 6 match services

**Files:**
- Create: `services/game-server/phase6.ts`
- Modify: `services/game-server/match.ts`, `services/game-server/pve/simulation.ts`, `services/game-server/pve/waves.ts`, `services/game-server/pve/damage.ts`
- Test: `services/game-server/phase6.test.ts`, `services/game-server/match.test.ts`

- [ ] Add a server-owned Phase6MatchState with wallet, score, contribution, inventory, upgrades, armor/consumables, gates, objectives, mini-boss, boss, operation journal, and bounded sentry placements.
- [ ] Apply kill/damage/revive/objective/gate/wave rewards atomically and separate Scrap from Score.
- [ ] Validate and execute purchase/equip/use/gate/objective commands only during valid Safe Room or combat states, with rate limits and request IDs.
- [ ] Add deterministic ten-wave production progression and preserve Phase 5 five-wave test configuration.
- [ ] Spawn and update the mini-boss and final boss with telegraphs, two phases, weak-point damage validation, cooldowns, and bounded reinforcement calls.
- [ ] Replace production phase completion with boss intro/active/victory/defeat and produce reconnect-complete snapshots.

### Task 3: Client protocol/runtime and HUD

**Files:**
- Modify: `src/game/client/runtime.ts`, `src/game/client/pve-hud.ts`, `src/game/client/network.ts`, `src/components/game/game-shell.tsx`, `src/components/game/game.module.css`
- Create: `src/components/game/phase6-shop.tsx`
- Test: `src/game/client/runtime.test.ts`, `src/components/game/phase6-shop.test.tsx`

- [ ] Consume Phase 6 snapshots/events with revision ordering and reconnect resets.
- [ ] Add keyboard-accessible shop overlay, weapon inventory, wallet/score/contribution, armor/items, objective/gate status, mini-boss/boss bars, and victory/defeat summary using existing tokens and live regions.
- [ ] Send only validated command intents and show purchase feedback after authoritative responses; respect reduced motion/flash settings.
- [ ] Add client tests for state application, duplicate/out-of-order events, shop disabled states, and summary rendering.

### Task 4: Documentation and verification

**Files:**
- Create: `docs/phase-6-architecture.md`, `docs/phase-6-development.md`, `docs/phase-6-verification.md`
- Modify: `README.md`

- [ ] Document profile selection, ten waves, economy, arsenal, shop/Safe Room, support item, gate, objectives, bosses, scoreboard, reconnect, protocol, persistence, deployment, environment variables, performance, limitations, and Phase 7 extension points.
- [ ] Run dependency integrity, lint, typecheck, unit/integration/e2e, production build, game-server build, protocol/database checks, and bounded performance scripts; report pre-existing failures separately.
- [ ] Perform a two-client manual smoke check where the configured environment permits it and record observed limitations.
