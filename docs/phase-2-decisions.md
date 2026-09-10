# Phase 2 decisions, assumptions, and deferrals

## Scope

Phase 2 turns the Phase 1 foundation into the public TwoPlayer platform experience: discovery, account and guest sessions, profile setup, preferences, a game catalog, game briefs, responsive navigation, and deliberate loading/error/empty states.

It does not implement live presence, rooms, room codes, invitations, matchmaking, lobby state, chat, voice, authoritative match sessions, or gameplay. Any copy that mentions those capabilities labels them as planned for a later phase.

## Decisions

### D2-01 — Keep authentication behind a replaceable service

`AuthService` owns the application-level operations while `AuthRepository` owns persistence. Pages and forms do not import Prisma or know how credentials and sessions are stored. The shipped adapter uses PostgreSQL through Prisma; an explicitly selected `AUTH_MODE=development` in-memory adapter exists for isolated local/UI work and tests only.

The development adapter is not production authentication. It loses identities when its process restarts and must never be selected in a production deployment.

### D2-02 — Use opaque, server-side sessions

Passwords are hashed with Node's built-in `scrypt` using a random salt. A login, registration, or guest continuation creates a cryptographically random opaque token; only its SHA-256 digest is stored in PostgreSQL. The raw value exists only long enough to be written to an HTTP-only, SameSite cookie. Password hashes and raw tokens never enter browser DTOs.

The session cookie uses `Secure` in production and is scoped to the application root. Logout revokes the persisted session before expiring the cookie. Guest sessions carry an explicit `GUEST` kind and a shorter lifetime than permanent-account sessions.

Registration and guest continuation persist the new identity and its initial session atomically. A session-insert failure therefore cannot leave a permanent account that blocks retry or an orphaned guest identity.

Issuing a new login, registration, or guest session replaces and revokes the prior browser session on a best-effort basis. Authentication operations also prune expired sessions and remove unreferenced expired guest identities; a future scheduled maintenance job remains appropriate for long-idle deployments.

### D2-03 — Authorize close to data and mutations

Server-side DAL functions resolve the current cookie to a safe session DTO. Profile and settings actions determine the acting user exclusively from that session; they accept no client-supplied user ID. Every mutation validates `FormData` with the domain Zod schemas and maps failures to a consistent, sanitized result shape.

The shared layout uses session state only for navigation presentation. Protected pages and every protected action repeat the authorization check near the data boundary, because hiding UI is not authorization.

### D2-04 — Treat guests as limited temporary accounts

A guest gets an explicit temporary identity and session so the same safe navigation/profile contracts can be exercised without pretending the user has a permanent account. Guest messaging recommends registration before future multiplayer features. Phase 2 gives guests no room, invitation, matchmaking, presence, or gameplay capability.

Guest-to-permanent-account conversion is deferred. Until that policy exists, a guest creates a separate permanent account through registration.

### D2-05 — Keep catalog presentation separate from the durable core model

The Phase 1 `Game` row remains the durable identity, slug, description, status, capacity, and thumbnail foundation. A typed catalog DTO adds presentational details—duration, difficulty, genre, tags, overview, and feature copy—without prematurely growing the database around the first title.

Development has a deterministic catalog containing the stable `nightfall-protocol` zombie-survival brief. The service prefers database rows and merges a matching deterministic presentation template. Deterministic fallback is limited to non-production execution: production database failures reach the route error boundary and an empty production catalog renders the deliberate empty state.

### D2-06 — Use server-rendered discovery with small client leaves

Home, catalog, game details, profile, and settings content render on the server. Client components are limited to actual interaction: forms, mobile navigation, image fallback, and pending state. Route-level `loading.tsx` files reserve the final geometry; `error.tsx` files explain the failure and offer retry/navigation.

Catalog data is mostly static and uses an explicit five-minute revalidation policy. Per-user session/profile data is request-scoped and is never put in shared cache entries.

### D2-07 — Reuse the Phase 1 design system

Phase 2 surfaces compose the existing semantic tokens and primitives. New feature components use the same typography, radius, elevation, 4/8px rhythm, focus ring, state colors, and 150–300ms motion conventions. Game art uses stable local CSS/SVG-like geometry with an optional image and failure fallback, avoiding a new asset pipeline.

The internal `/design-system` route remains available. It is no longer the root experience and still contains no product behavior.

## Assumptions

- npm, Node.js 20.19+, Next.js 16.3, React 19, Prisma 6, and PostgreSQL remain the selected stack.
- Email is required for permanent password accounts; usernames are normalized to lowercase and contain only ASCII letters, numbers, and underscores.
- Passwords are 8–128 characters. Password reset and email verification require an outbound email provider and are deferred.
- The selected local/database authentication implementation is appropriate for Phase 2 evaluation, but production launch still requires abuse controls, credential-recovery policy, and operational review.
- `nightfall-protocol` is the stable slug for the planned cooperative zombie shooter.
- “Available preview” means its product brief is browsable; it does not mean a live multiplayer match can start.
- The catalog contains no online-player counts. Presence remains exclusively a future real-time concern.
- Avatar URL plus deterministic initials is sufficient for Phase 2; uploads and object storage are deferred.
- English is the active interface language. Persian-capable fonts, logical CSS, and a stored locale preference preserve RTL readiness, but full localization is not claimed.
- The browser's `prefers-reduced-motion` setting is honored globally, and the authenticated shell applies the stored account preference to the current experience.

## Deferred decisions and risks

### Before production authentication exposure

- Select a distributed rate-limit/abuse-control system compatible with Vercel; an in-process limiter would not be reliable across functions.
- Decide email verification, password reset, credential breach checks, username-change limits, guest conversion, concurrent-session policy, and session-management UI.
- Define privacy export/deletion and account retention. The settings page does not perform destructive account deletion.
- Choose a production PostgreSQL provider, connection pooler, migration promotion/rollback process, backups, and restore drills.
- Add CSRF/origin tests around any future non-Server-Action mutation endpoint and run a dedicated security review.

### Before Phase 3

- Select and validate the real-time provider against the Phase 1 gateway.
- Define who may create/join rooms, guest eligibility, room-code enumeration controls, invite expiry, and capacity enforcement.
- Define live-versus-durable room ownership, reconciliation, idempotency, reconnect leases, and duplicate-session behavior.
- Specify presence privacy, timeout, degraded mode, and regional latency expectations.

### Product and UX follow-up

- Move catalog presentation metadata into an owned content source if non-engineers need to edit it.
- Add image hosting and moderation before accepting user uploads or arbitrary public avatar sources at scale.
- Validate complete Persian translations, bidirectional mixed text, and all flows with assistive technology before advertising localization.
- Add browser-level end-to-end authentication tests against an isolated PostgreSQL instance once CI database provisioning is selected.

## Boundary confirmation

Phase 2 adds only platform discovery and account/profile experience. It creates no room or match record, opens no real-time connection, tracks no online presence, allocates no match session, and implements no chat, voice, shooter rendering, movement, weapon, zombie, wave, boss, shop, result, progression, or monetization system.
