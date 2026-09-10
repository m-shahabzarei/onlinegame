# TwoPlayer Phase 1 Foundation Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete technical, architectural, domain, configuration, and visual foundation for TwoPlayer without implementing authentication, rooms, presence, matchmaking, or gameplay flows.

**Architecture:** Use a Next.js App Router web application as the Vercel-deployable shell, PostgreSQL through Prisma for durable records, and a provider-neutral TypeScript gateway for all future real-time behavior. Keep UI primitives, domain constraints, server-only services, configuration, database access, and real-time contracts in explicit source boundaries.

**Tech Stack:** Next.js 16, React 19, strict TypeScript 5.9, Tailwind CSS 4, Prisma 6/PostgreSQL, Zod 4, Radix UI, Lucide, Vitest 3, Testing Library, ESLint, and Prettier.

## Global Constraints

- Implement only Phase 1.
- Do not implement authentication, user registration, presence behavior, rooms, matchmaking, chat, voice, rendering, gameplay, progression, results, or monetization.
- Keep the authoritative real-time game server outside Vercel and replaceable behind interfaces.
- Store no secrets or production connection strings.
- Use semantic design tokens, visible focus, approximately 44px targets, and reduced-motion support.
- Do not initialize Git or create commits.

---

### Task 1: Tooling and application shell

**Files:**

- Create: `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`
- Create: `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `postcss.config.mjs`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

**Interfaces:**

- Produces the `@/*` TypeScript alias and scripts `dev`, `build`, `lint`, `typecheck`, `test`, `format:check`, `db:generate`, and `db:validate`.

- [ ] **Step 1: Define the pinned package manifest and strict compiler settings.**

  Configure `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, App Router-compatible JSX, and the `@/* -> src/*` alias. Pin Node-compatible Vitest 3 because the available runtime is Node 20.

- [ ] **Step 2: Install dependencies and produce one npm lockfile.**

  Run: `npm install`
  Expected: dependencies resolve with no unsupported-engine error.

- [ ] **Step 3: Add the App Router shell.**

  The root route redirects to `/design-system`; the layout self-hosts display, body, mono, and Persian-capable fonts using `next/font` and includes a keyboard skip link.

- [ ] **Step 4: Verify the shell types.**

  Run: `npm run typecheck`
  Expected: PASS once the later referenced component files exist.

### Task 2: Configuration and health foundation

**Files:**

- Create: `.env.example`
- Create: `src/config/env-schema.ts`, `src/config/public-env.ts`, `src/config/server-env.ts`
- Create: `src/server/services/health-service.ts`
- Create: `src/app/api/health/route.ts`
- Test: `src/config/env-schema.test.ts`

**Interfaces:**

- Produces `parsePublicEnv(input)`, `parseServerEnv(input)`, `getPublicEnv()`, `getServerEnv()`, and `getHealthStatus()`.
- `ServerEnv` separates `database`, `realtime`, and `observability` groups; only `NEXT_PUBLIC_APP_URL` is client-safe.

- [ ] **Step 1: Write environment parser tests.**

  Cover a valid PostgreSQL URL, a missing `DATABASE_URL`, rejection of a non-HTTP real-time URL, and public default behavior.

- [ ] **Step 2: Confirm the focused tests initially fail.**

  Run: `npm test -- src/config/env-schema.test.ts`
  Expected: FAIL before the parser exists.

- [ ] **Step 3: Implement lazy typed parsing.**

  `parseServerEnv` requires `DATABASE_URL`; `getServerEnv` reads it only when a server request/service needs it so static compilation never leaks or eagerly requires secrets. Optional real-time and observability values remain server-only.

- [ ] **Step 4: Add the health route.**

  Return JSON with service/version/time and a sanitized configuration status; return 503 with no secret values when required configuration is invalid.

- [ ] **Step 5: Run the configuration tests.**

  Run: `npm test -- src/config/env-schema.test.ts`
  Expected: PASS.

### Task 3: Domain and database foundation

**Files:**

- Create: `prisma/schema.prisma`
- Create: `src/db/client.ts`
- Create: `src/domain/user.ts`, `src/domain/game.ts`, `src/domain/room.ts`, `src/domain/match.ts`, `src/domain/index.ts`
- Test: `src/domain/room.test.ts`

**Interfaces:**

- Produces immutable domain shapes and enums for users, games, rooms, members, and matches.
- Produces `usernameSchema`, `roomCodeSchema`, `playerCapacitySchema`, and `roomFoundationSchema` for invariants that are not adequately expressed by SQL types alone.

- [ ] **Step 1: Write domain constraint tests.**

  Verify room codes accept 6–12 uppercase alphanumeric characters, reject lowercase/punctuation, and room/player capacity accepts 2–4 only.

- [ ] **Step 2: Implement the domain schemas and types.**

  Keep domain modules independent from React and Prisma-generated code so both the Vercel app and a future external provider can share the contracts.

- [ ] **Step 3: Define the Prisma schema.**

  Add `User`, `Game`, `Room`, `RoomMember`, and `Match`; use cuid primary keys, unique username/slug/code fields, a composite room-member key, indexed query paths, explicit enums, cascading membership cleanup, and restrictive match-history relations. Do not add a Presence table.

- [ ] **Step 4: Validate and generate the client.**

  Run: `npm run db:validate` and `npm run db:generate`
  Expected: both PASS using the sanitized local validation URL supplied only to the command environment.

- [ ] **Step 5: Run domain tests.**

  Run: `npm test -- src/domain/room.test.ts`
  Expected: PASS.

### Task 4: Provider-neutral real-time boundary

**Files:**

- Create: `src/realtime/contracts.ts`, `src/realtime/realtime-gateway.ts`, `src/realtime/unconfigured-realtime-gateway.ts`, `src/realtime/index.ts`

**Interfaces:**

- Produces `RealtimeGateway` operations `createRoom`, `joinRoom`, `leaveRoom`, `subscribeToRoom`, `getPresence`, `createMatchSession`, `disconnect`, and `reconnect`.
- Produces provider-neutral snapshots, event envelopes, presence records, connection state, unsubscribe callbacks, and a typed `RealtimeUnavailableError`.

- [ ] **Step 1: Define serializable contracts.**

  Use domain IDs and ISO date strings without importing any Colyseus, Nakama, Photon, or vendor SDK type.

- [ ] **Step 2: Define the gateway interface.**

  Each command returns a promise; subscriptions return an unsubscribe function; reconnect accepts a provider-neutral token.

- [ ] **Step 3: Add an unconfigured adapter.**

  All command methods reject with `RealtimeUnavailableError`; subscription returns a no-op cleanup. This is an explicit Phase 1 placeholder, not room or presence behavior.

### Task 5: Design tokens and primitives

**Files:**

- Create: `src/lib/cn.ts`
- Create: `src/components/ui/button.tsx`, `icon-button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, `select.tsx`, `dialog.tsx`, `tabs.tsx`, `avatar.tsx`, `status-indicator.tsx`, `skeleton.tsx`, `empty-state.tsx`, `error-state.tsx`, `divider.tsx`, `tooltip.tsx`, `index.ts`
- Test: `src/components/ui/button.test.tsx`

**Interfaces:**

- Produces reusable typed React primitives with semantic variants.
- `Button` accepts `variant`, `size`, `loading`, and `loadingText`; `IconButton` requires an accessible label; feedback components accept optional actions.

- [ ] **Step 1: Define semantic CSS tokens.**

  Centralize dark-first background, surface, primary, secondary, accent, foreground, muted, border, success, warning, destructive, ring, typography, radius, shadow, spacing, breakpoint, motion, and z-index values in `globals.css`.

- [ ] **Step 2: Write button interaction tests.**

  Verify accessible text, disabled semantics during loading, `aria-busy`, and spinner visibility.

- [ ] **Step 3: Implement native and Radix-backed primitives.**

  Use semantic token utilities only. Preserve 44px targets, stable loading dimensions, keyboard focus, pressed and disabled feedback, and Lucide SVG icons.

- [ ] **Step 4: Run the component test.**

  Run: `npm test -- src/components/ui/button.test.tsx`
  Expected: PASS.

### Task 6: Showcase and framework states

**Files:**

- Create: `src/components/design-system/design-system-showcase.tsx`
- Create: `src/app/design-system/page.tsx`
- Create: `src/app/loading.tsx`, `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/not-found.tsx`

**Interfaces:**

- Produces the `/design-system` internal preview route and consistent loading/error/not-found conventions.

- [ ] **Step 1: Build the responsive component showcase.**

  Demonstrate button variants and enabled/loading/disabled states, form controls, cards, badges, avatar/status, tabs, dialog, tooltip, skeletons, empty/error feedback, and dividers. Include no lobby, room flow, or gameplay UI.

- [ ] **Step 2: Add route-level states.**

  Error boundaries expose a safe retry action; loading uses stable skeleton geometry; not-found provides a route back to the preview.

- [ ] **Step 3: Manually inspect at 375, 768, 1024, and 1440px.**

  Expected: no horizontal overflow, clear focus/hover/pressed states, and readable hierarchy.

### Task 7: Developer and architecture documentation

**Files:**

- Create: `README.md`
- Create: `docs/architecture.md`, `docs/domain-model.md`, `docs/design-system.md`, `docs/phase-1-decisions.md`

**Interfaces:**

- Documents setup/scripts/env, Vercel versus external-server ownership, data flow/deployment, durable versus transient state, tokens/accessibility/motion, assumptions, defaults, deferrals, and Phase 2 risks.

- [ ] **Step 1: Write local-development documentation.**

  Document Node/npm prerequisites, copying `.env.example`, scripts, database validation/generation, and the `/design-system` and `/api/health` routes.

- [ ] **Step 2: Document architecture and domain ownership.**

  Explicitly place site/API/auth integration on Vercel, durable records in PostgreSQL, and presence/room/game simulation in the external authoritative server.

- [ ] **Step 3: Document the design system and Phase 1 decisions.**

  Record token meanings, typography/Persian fallback, spacing/breakpoints, component states, WCAG/reduced-motion rules, assumptions, deferred choices, and risks.

### Task 8: Full verification and scope audit

**Files:**

- Modify only files implicated by verification failures.

- [ ] **Step 1: Format and check formatting.**

  Run: `npm run format` then `npm run format:check`
  Expected: PASS.

- [ ] **Step 2: Run static quality gates.**

  Run: `npm run lint` and `npm run typecheck`
  Expected: PASS.

- [ ] **Step 3: Validate Prisma and run tests.**

  Run: `npm run db:validate`, `npm run db:generate`, and `npm test`
  Expected: PASS.

- [ ] **Step 4: Run a production build.**

  Run: `npm run build`
  Expected: PASS without a production database or real-time provider connection.

- [ ] **Step 5: Start the production server and probe routes.**

  Run the built server with a sanitized local `DATABASE_URL`, then request `/design-system` and `/api/health`.
  Expected: both HTTP 200; the health response exposes no URL or secret.

- [ ] **Step 6: Audit Phase 1 scope and file inventory.**

  Search for provider SDKs and forbidden feature implementations. Confirm only contracts/placeholders and design-system examples exist, then report every created file and every command result.
