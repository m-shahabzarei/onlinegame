# Phase 8 release readiness

Phase 8 is the production polish and live-operations layer for the existing Phase 1–7 platform. Vercel continues to host the web application and game client; the authoritative gameplay server remains on a separate persistent runtime.

## Release gate

Before production: pass security/dependency/secret checks, database migration validation, content validation, lint/type/unit/integration/security/browser checks, staging two-client smoke, match-history/challenge/cosmetic/report flows, maintenance mode, production-like health/readiness, protocol compatibility, rollback and backup/restore verification. Record application, protocol, map, content, challenge and cosmetic versions together. A local build alone is not production readiness.

## Onboarding and UX

The first-session overlay is short, keyboard reachable, skippable, resumable in browser storage and replayable from Settings. It explains discovery, rooms, Ready, WASD/mouse/fire/reload/revive, Scrap versus Score/Contribution, reconnect, safe leave and reporting. Reduced-motion preferences remain respected by the existing shell.

## Data and privacy

Match history is participant-scoped and paginated. It stores bounded summaries only. Challenge progress is server-owned, capped and completion-idempotent. Cosmetics are curated free definitions and cannot affect gameplay values. Reports are private, sanitized and rate-limited. Analytics uses versioned, pseudonymized events and drops opted-out/invalid events. Retention: history and challenge progress follow account retention; guest records are cleaned with their guest session; reports are retained only for the documented safety review period; raw gameplay payloads, tokens, cookies and private room codes are never analytics fields.

## Operations

`/api/status` exposes maintenance/game availability without secrets. `TWOPLAYER_FLAG_*` values default safely and are server evaluated; risky flags fail closed. Operator access remains an infrastructure responsibility and must not be exposed to ordinary users. Enable maintenance before disruptive deployment, drain or allow active matches to finish, deploy matched web/game artifacts, run smoke checks, then disable maintenance.

## Rollback and incidents

Rollback uses the last known-good web and game-server artifacts, preserves the forward-compatible schema, and never deletes active match state. Contain token/account/gameplay/economy/challenge/cosmetic/report incidents with the relevant feature flag or maintenance mode, collect redacted request/match ids, verify recovery, and document a follow-up. No automatic bans are triggered from a single report.

## Compatibility and support

The application, game server, protocol, map, content, challenge and cosmetic definitions are versioned independently but released as a compatible artifact set. Existing protocol rejection and the Phase 7 game-server version endpoint remain the compatibility boundary. Supported browser checks remain Chrome, Edge and Firefox on desktop; unsupported WebGL or input devices receive a clear platform/lobby message. Responsive QA targets 375, 768, 1024 and 1440 pixels, with gameplay QA at 1280x720 and 1920x1080. Known limitations include mouse-and-keyboard FPS accessibility and the absence of text/voice communication.

CI should run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run db:validate`, `npm run game:build`, the production build, secret/dependency checks and `npm run release:check`. The release gate script verifies required artifacts and production environment prerequisites without printing secret values. Staging remains the only place for load, chaos, browser and rollback verification before a public release.
