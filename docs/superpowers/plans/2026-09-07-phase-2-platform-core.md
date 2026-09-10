# Phase 2 Platform Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Phase 1 foundation into a polished, safe, responsive TwoPlayer platform shell with replaceable local authentication, profile/settings flows, game discovery, and deliberate UX states—without implementing rooms, presence, matchmaking, or gameplay.

**Architecture:** Keep the Next.js 16 App Router as the Vercel web/control plane and keep server-only concerns behind `src/server`. Add a small database-backed authentication adapter (hashed credentials, hashed opaque cookie sessions, and explicit temporary guest accounts) behind an `AuthService` contract; pages read through a DAL and mutations use validated Server Actions. Add a deterministic catalog service that prefers persisted `Game` rows and falls back to a typed development catalog, while all route UI composes the existing semantic-token primitives.

**Tech Stack:** Next.js 16.3 App Router, React 19, strict TypeScript, Tailwind CSS 4, Prisma 6/PostgreSQL, Zod 4, Vitest + Testing Library, Radix UI, Lucide.

## Global Constraints

- Implement Phase 2 only: public discovery, auth/session UX, guest continuation, profile, settings, catalog, details, and reusable loading/error/empty states.
- Do not implement presence, online-player tracking, rooms, room codes, invitations, matchmaking, realtime subscriptions/sessions, chat, voice, or any gameplay system.
- Preserve the Phase 1 folder boundaries, tokens, primitives, realtime gateway, tests, and user changes; do not commit.
- Follow the installed Next.js 16 APIs: async `cookies()`, Promise `params`, App Router `loading.tsx`/`error.tsx`/`not-found.tsx`, Server Actions with server-side validation, and explicit caching for static catalog data.
- Never place secrets, password hashes, session tokens, or database access in client bundles; never store plaintext passwords.
- Keep interactive targets at least 44px, visible focus rings, semantic labels, reduced-motion behavior, stable image dimensions, and no horizontal scrolling at 375/768/1024/1440px.
- Use semantic design tokens and Lucide icons; no raw feature-level hex colors or emoji UI icons.

## File Map

**Create**

- `src/domain/auth.ts`, `src/domain/profile.ts`, `src/domain/catalog.ts`: framework-independent contracts and Zod schemas.
- `src/server/auth/password.ts`, `src/server/auth/session.ts`, `src/server/auth/auth-service.ts`, `src/server/auth/index.ts`: password hashing, opaque session lifecycle, and replaceable auth boundary.
- `src/server/dal/session.ts`, `src/server/dal/profile.ts`, `src/server/dal/catalog.ts`: server-only authorized reads and DTO mapping.
- `src/server/actions/auth.ts`, `src/server/actions/profile.ts`, `src/server/actions/settings.ts`: validated mutations that return consistent action results.
- `src/server/catalog/catalog-data.ts`, `src/server/catalog/catalog-service.ts`: deterministic development entries and database/fallback catalog reads.
- `src/components/app/app-shell.tsx`, `src/components/app/mobile-nav.tsx`, `src/components/app/account-menu.tsx`, `src/components/app/auth-aware-nav.tsx`: shared responsive shell and navigation.
- `src/components/catalog/game-card.tsx`, `src/components/catalog/game-art.tsx`, `src/components/catalog/catalog-grid.tsx`, `src/components/catalog/catalog-states.tsx`: reusable catalog presentation.
- `src/components/forms/auth-form.tsx`, `src/components/forms/profile-form.tsx`, `src/components/forms/settings-form.tsx`, `src/components/forms/logout-button.tsx`: accessible client form leaves.
- `src/components/feedback/page-header.tsx`, `src/components/feedback/guest-callout.tsx`, `src/components/feedback/status-panel.tsx`: shared page/limitation states.
- `src/app/(platform)/layout.tsx` and route files under `src/app/(platform)/...` for the public/account shell.
- Route-local `loading.tsx` and `error.tsx` files for catalog, details, auth, profile, and settings where a segment has distinct UX.
- `src/app/api/auth/session/route.ts`, `src/app/api/auth/logout/route.ts`, `src/app/api/games/route.ts`, `src/app/api/games/[slug]/route.ts`, `src/app/api/profile/route.ts` only where browser/server boundaries need a standard API.
- Focused tests under `src/server/**/*.test.ts`, `src/components/**/*.test.tsx`, and route/service tests as needed.

**Modify**

- `prisma/schema.prisma`: add only nullable auth/profile preference fields and a `Session` model with indexes/expiry; do not add rooms/presence/match behavior.
- `src/config/env-schema.ts`, `src/config/server-env.ts`, `src/config/public-env.ts`, `.env.example`: add explicit auth/session settings with safe development defaults and no secrets.
- `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`, `src/app/not-found.tsx`, `README.md`, `docs/architecture.md`, `docs/domain-model.md`, `docs/phase-1-decisions.md`, `docs/design-system.md`: change metadata, shell, root discover page, and Phase 2 documentation while preserving Phase 1 history.
- `src/components/ui/*` only when a concrete Phase 2 state gap exists; add no parallel visual language.

### Task 1: Lock contracts and persistence boundary

**Files:** Create domain/config/auth contract files above; modify Prisma schema and env example; test domain schemas and env parsing.

- [ ] Add `AuthSession`, `SafeUser`, `AuthResult`, `GuestSession`, profile/settings input schemas, and catalog DTO types without importing Next, Prisma, or React.
- [ ] Extend `User` with unique nullable `email`, nullable `passwordHash`, `isGuest`, optional `bio`, `locale`, `reducedMotion`, `soundEnabled`; add `Session` with hashed token, user relation, kind, expiry, created/updated timestamps, and indexes. Use cascading user deletion for sessions only; do not alter Phase 1 room/match ownership rules.
- [ ] Add `AUTH_MODE` (`development`/`database`), `SESSION_COOKIE_NAME`, `SESSION_TTL_DAYS`, and optional auth URL settings to typed server config; reject malformed values and keep `DATABASE_URL` server-only.
- [ ] Test registration, login, guest, username, and profile schemas for valid values, malformed values, duplicate-safe normalization, and password confirmation.
- [ ] Run `npm run db:format`, `npm run db:validate`, `npm run db:generate`, and the focused tests; record any unavailable live database limitation instead of weakening validation.

### Task 2: Implement replaceable secure local authentication

**Files:** Create `src/server/auth/*`, `src/server/dal/session.ts`, auth actions/API routes, and auth tests.

- [ ] Implement async `scrypt` password hashing with a per-password random salt and constant-time verification; expose no hash to DTOs.
- [ ] Generate a cryptographically random opaque session token, store only its SHA-256 digest, set an HTTP-only `SameSite=Lax` secure-in-production cookie, and delete expired/revoked sessions.
- [ ] Implement `AuthService` methods `register`, `login`, `createGuestSession`, `getCurrentSession`, `logout`, and `requireUser` through Prisma; map unique constraint failures to stable user-facing error codes.
- [ ] Keep a clearly labeled development-only in-memory/test adapter for tests, selected only by explicit `AUTH_MODE=development`; production mode must require database configuration and never silently use a mock.
- [ ] Add server actions with `safeParse` and authorization checks, plus route handlers for session/logout only if required by client navigation. Return `{ ok, data?, error?: { code, message, fieldErrors? } }` consistently.
- [ ] Test password non-storage, invalid credentials, duplicate registration, cookie/session round trips, guest identity expiry semantics, logout, and unauthorized profile access.

### Task 3: Build the app shell and auth-aware navigation

**Files:** Modify root/layout/page; create platform layout and app-shell components; add mobile-nav/account-menu tests.

- [ ] Replace the Phase 1 root redirect with a server-rendered discover page inside a shared shell; keep `/design-system` available as the internal showcase.
- [ ] Render brand, Games link, accessible desktop navigation, a 44px mobile menu trigger, auth-aware Login/Register/Guest actions, and signed-in Profile/Settings/logout affordances from a safe session DTO.
- [ ] Use a nested platform layout with a skip target, responsive content container, safe header spacing, and semantic `header/nav/main/footer`; do not gate public pages in a layout.
- [ ] Add a small client component only for menu open/close and logout pending state; preserve browser back behavior and keyboard escape/focus semantics.
- [ ] Test visible nav labels for signed-out, guest, and signed-in states and ensure no room/matchmaking link appears.

### Task 4: Add deterministic game catalog service and cards

**Files:** Create catalog service/data/components/routes and catalog tests.

- [ ] Define a stable `nightfall-protocol` entry for the planned two-player cooperative zombie shooter with status, capacity, duration, difficulty, genre/tags, overview, and feature copy; label planned multiplayer actions as Phase 3.
- [ ] Read active database games on the server with explicit cache/revalidation; map rows to DTOs and use the deterministic entry only when no usable rows are available. Never add online counts or room actions.
- [ ] Build `GameArt` with local CSS/SVG treatment and fixed aspect ratio, `GameCard` with accessible link/name, status badge, capacity/duration metadata, and stable action target, and responsive `CatalogGrid`.
- [ ] Add `/games` page with page header, catalog skeleton, empty state with retry/navigation, error state with retry, and maintenance/coming-soon labels. Keep search/filter omitted unless backed by real data.
- [ ] Test catalog mapping, first-game presence, card semantics, empty/error state copy, and image fallback behavior.

### Task 5: Implement game details and public home experience

**Files:** Create home/details components/routes and route state files; test missing slug/details rendering.

- [ ] Build home hero with one primary CTA to `/games`, secondary catalog link, cinematic token-only background treatment, featured cards, three-step explanation, and non-interactive Coming Soon capability cards.
- [ ] Build `/games/[slug]` using awaited Promise params and `notFound()` for unknown slugs; show art, title, description, overview, capacity, duration, difficulty, status, feature list, and one safe preparation CTA that cannot create/join anything.
- [ ] Handle maintenance and coming-soon statuses with explicit informational panels, image failures with text fallback, and no fabricated gameplay stats.
- [ ] Add `loading.tsx`, `error.tsx`, and route-level not-found UX with retry/back links; use metadata helpers for accessible page titles.
- [ ] Test home CTA destination, details content, invalid slug not-found, status-specific action copy, and route error recovery.

### Task 6: Implement registration, login, guest continuation, profile, and settings

**Files:** Create route pages/forms/actions/DAL files and profile/settings tests.

- [ ] Add `/register` and `/login` forms with visible labels, inline field errors, password confirmation, pending/disabled states, keyboard order, duplicate/invalid credential messages, and links between account paths and guest continuation.
- [ ] Add `/continue-as-guest` explicit explanation, temporary-session action, guest limitations callout, and redirect to `/` after success; do not expose a fake permanent-account claim.
- [ ] Add protected `/profile` and `/settings` pages that read the current session server-side and redirect unauthenticated users to `/login?next=...`; profile form validates username/display name/avatar/bio, preserves input on errors, and reports save/success/failure via `aria-live`.
- [ ] Enforce username uniqueness and ownership on the server action; update only the authenticated user and never trust a client user ID. Add settings for display name/avatar, locale placeholder, reduced motion, sound preference, logout, and a clearly non-destructive delete-account placeholder.
- [ ] Add page-level loading/error/empty states and unsaved-change warning only where a client form can reliably detect dirty state; keep actions reversible.
- [ ] Test all required validation and authorization cases, guest limitation copy, profile update ownership, settings persistence, and auth-aware redirects.

### Task 7: Accessibility, responsive QA, and documentation

**Files:** Modify global tokens/metadata/docs; add focused UI state tests and optional route smoke tests.

- [ ] Audit all new controls for focus-visible, pressed, disabled, loading, selected, `aria-live`, label/error association, alt text, and color-independent status; ensure reduced-motion CSS applies to new transitions.
- [ ] Verify layouts at 375, 768, 1024, and 1440px with no horizontal overflow, reserved art dimensions, readable line lengths, RTL-ready logical spacing, and no fixed UI overlap.
- [ ] Update README scripts/env workflow, architecture data flow/deployment model, domain persistent-vs-session state, design-system usage, and Phase 2 decisions/deferrals; explicitly document that rooms/presence/matchmaking/gameplay remain Phase 3+.
- [ ] Run formatting, lint, strict typecheck, all Vitest tests sequentially, Prisma validation/generation, and production build from the same-volume mirror if the D: junction causes the known webpack resolution failure. Report pre-existing failures distinctly.

## Verification checklist

Run these commands from the repository unless the junction limitation requires the documented C: mirror:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test -- --reporter=dot --maxWorkers=1 --minWorkers=1
npm run db:format
npm run db:validate
npm run db:generate
npm run build
```

Smoke-test `/`, `/games`, `/games/nightfall-protocol`, an invalid game slug, `/login`, `/register`, `/continue-as-guest`, `/profile`, and `/settings` in a local browser at the four required widths. Confirm that no route creates a room, match, presence record, realtime session, or gameplay state.
