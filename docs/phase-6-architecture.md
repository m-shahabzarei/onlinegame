# Phase 6 architecture

Phase 6 adds a match-only state layer in `services/game-server/phase6.ts`. It owns Scrap, Score, Contribution, weapon ownership, primary/secondary selection, per-weapon ammunition and upgrades, Safe Room shop timing, the final boss, and the summary. `src/game/shared/phase6.ts` validates content definitions and resolves live weapon statistics. See [the current shop and combat rules](shop-and-combat.md) for protocol 3 and inventory details.

The player-facing solo and co-op profile is `phase6-production`: ten regular waves, 30-second intermissions, and the final boss after the final resupply. `phase5-test` remains an injected five-wave compatibility test profile. Existing zombie AI, life, revive, and navigation remain authoritative.

Scrap is spendable only in the active match. Score and Contribution are separate bounded metrics and are never accepted from clients. Purchases and equips use request IDs recorded in an in-memory journal, validate ownership/prerequisites/capacity, and return a structured `shopResult` with the authoritative snapshot. Accepted changes broadcast `phase6State`. Reconnect restores the loadout inside `welcome`/`worldSnapshot`; no gameplay state is written per tick to Prisma.

Armor, medkits, grenades, sentries, gates, and objectives still have content definitions but lack complete authoritative use/deployment/map effects. Their commands are rejected without spending; the shop marks this content unavailable. Separate mini-boss content is not active.

The final boss is a real pooled brute entity with two health phases and a server-owned victory transition. It currently reuses the brute model, telegraphs, and attack pattern; bespoke ranged attacks and reinforcements are future content. Defeat stops further operations. No permanent gameplay progression or currency is implemented. The external persistent game server remains required; Vercel hosts the web app/client.
