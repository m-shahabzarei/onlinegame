# Phase 6 architecture

Phase 6 adds a match-only state layer in `services/game-server/phase6.ts`. It owns Scrap, Score, Contribution, two-slot weapon ownership, per-weapon ammunition and upgrades, support inventory, Safe Room shop timing, one Sentry Turret inventory, gate state, two optional objective definitions, an elite mini-boss, the two-phase Abomination boss, and the final summary. `src/game/shared/phase6.ts` validates every content definition at startup and exposes pure arithmetic/stat helpers.

The production profile is `phase6-production`: ten regular waves, mini-boss on Wave 5, gate `gate-east`, generator-defense and intel-recovery objectives, and the final boss after Wave 10. `phase5-test` remains available as a deterministic five-wave compatibility profile. Existing Phase 5 zombie AI, life, revive, and navigation remain authoritative.

Scrap is spendable only in the active match. Score and Contribution are separate bounded metrics and are never accepted from clients. Purchases and interactions use request IDs recorded in an in-memory journal, validate ownership/prerequisites/capacity, and return a complete authoritative `phase6State` snapshot. Reconnect receives this snapshot inside `welcome`/`worldSnapshot`; no gameplay state is written per tick to Prisma.

The selected deployable is a stationary Sentry Turret inventory item with a maximum of two purchased units per player and two active units per player. The current implementation exposes bounded inventory and state; turret simulation can be extended behind the same server-owned state boundary.

The boss has an intro and active state, a 55% health phase transition, weak-point multiplier, telegraphed attacks, bounded reinforcement counts, and a server-owned victory transition. Defeat stops further operations. No permanent progression, currency, cosmetics, monetization, chat, leaderboards, or analytics are implemented. The external persistent game server remains required; Vercel hosts the web app/client.
