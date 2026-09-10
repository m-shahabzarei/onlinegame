# Shop, Combat, and Localization Implementation Plan

> **For agentic workers:** Use subagent-driven execution task by task, with integration and verification in the parent task.

**Goal:** Connect the authoritative inventory to live combat and complete English/Persian presentation.

**Architecture:** The separate Node/WebSocket server owns the inventory, per-weapon state, shop deadline, and rewards. React translates semantic events using the existing typed catalog; the Three.js client predicts effects and suspends local intent while dialogs are open.

**Tech Stack:** Next.js 16.3.4, React 19, Three.js, Rapier, Zod, Radix Dialog, Vitest, Playwright.

## Global constraints

- Preserve unrelated user changes; this workspace does not contain Git metadata.
- Next.js/client deploy to Vercel; the authoritative game server remains separate.
- No client damage, rewards, ownership, ammunition, unlocks, or outcomes are trusted.
- Keep solo and two-player co-op; bump the shared protocol with both implementations.
- Keep the cinematic design and existing dependencies/local Persian fonts.

### 1. Authoritative inventory and combat

**Files:** `src/game/shared/{phase6,weapon,protocol,physics,config}.ts`, `services/game-server/{match,phase6}.ts`, `services/game-server/pve/{damage,simulation,waves}.ts` and tests.

**Interface:** Protocol v3; slots `{primary,secondary}`; `ammo[weaponId]` is a full weapon state. `equipWeapon` carries slot, sequence, weapon and request IDs. `shopResult` carries a semantic code and authoritative snapshot. Fire carries a press counter and release intent. Global sequences and cooldown survive switching and reconnect.

- [x] Test purchases at deadline and duplicate IDs; assert `scrapAfter === scrapBefore - cost` exactly once.
- [x] Test slot conflict then explicit replacement; assert secondary is preserved and old ownership remains selectable.
- [x] Route fire/reload/rays/damage through `resolveWeaponStats(id, level)`; test every weapon, upgrades, reload/switch cooldown, trigger validation and reconnect.
- [x] Connect death/damage/wave rewards using unique authority event IDs; reject unavailable consumables before spending.
- [x] Use production intermission duration and broadcast deadline closure.

### 2. Client shop and combat presentation

**Files:** `src/game/client/{runtime,input,rendering,audio,pve-hud,network}.ts`, `src/components/game/{game-shell,phase6-shop}.tsx`, `src/i18n/game-messages.ts` and tests.

**Interface:** Runtime owns local dialog visibility separately from authoritative availability; opening clears held intent and releases pointer lock. Digit1/2 use selected slots. React translates semantic notices and renderer labels.

- [x] Test B during/after intermission, pointer-lock loss, Escape, focus restoration and expiry.
- [x] Implement Radix dialog, countdown, replacement confirmation, equip actions, capacities and localized result feedback.
- [x] Use authoritative selected ammo/stats for HUD and prediction; reuse procedural model buffers/materials and distinct synth cues.
- [x] Verify live weapon differences and reconnect through browser flows.

### 3. Localization core and server pages

**Files:** `src/i18n/*`, `src/app/**`, locale actions/switcher and font configuration.

**Interface:** One typed `clientTranslate/translate(locale,key,params)` API; identical EN/FA trees, Intl formatting, locale context. Resolution explicit > user > cookie > English.

- [x] Test tree/placeholder parity and source audit failures for hardcoded UI text.
- [x] Persist authenticated locale and cookie together; refresh App Router after durable save with pending/error feedback.
- [x] Translate metadata/pages/loading/errors, use existing local font weights and logical CSS.

### 4. Component localization

**Files:** all nongame `src/components/**`, platform feature catalog and action error presentation.

- [x] Audit all rendered strings, attributes, announcements and data descriptions before translating.
- [x] Replace inline bilingual branches with typed keys and semantic error maps.
- [x] Test representative Persian lobby/forms/navigation and technical LTR tokens.

### 5. Integration and acceptance

- [x] Run format, lint, typecheck, full unit tests, game/PvE suites, both builds and relevant Playwright flows.
- [x] Verify solo and co-op wave → shop → purchase → switch → combat → reconnect in English and Persian.
- [x] Inspect RTL at 375, 768, 1024 and 1440 pixels; report evidence and any blocked or incomplete acceptance items honestly.
