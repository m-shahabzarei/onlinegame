# Phase 5: cooperative zombie survival

The web application and game client can be hosted on Vercel. The authoritative gameplay server requires a persistent external runtime. PostgreSQL is never part of the simulation loop.

Phase 5 contains **five waves and five zombie archetypes**. It does not contain shops, economy, multiple weapons, upgrades, bosses, objectives, rewards, XP, progression, leaderboards, cosmetics, monetization, chat or voice chat. The AR-01 remains the only usable weapon.

## Boundaries

The Phase 4 reservation, guest/authentication, signed join tickets, process epochs, connection ownership, rate budgets, Rapier player movement, prediction and WebSocket service remain in place. `MatchInstance` composes `PvESimulation`. Shared Zod schemas live in `src/game/shared/pve.ts` and `protocol.ts`; no simulation code enters the web bundle.

| System                                   | Responsibility                                                                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `WaveDirector` / `DifficultySystem`      | Validated five-wave plan, weighted budget, guaranteed introductions, scheduled/queued/alive/defeated/reinforcement accounting, bounded multipliers and transitions |
| `ZombieDefinitionRegistry`               | Exactly five validated definitions; all archetype combat, motion and ability tuning                                                                                |
| `SpawnDirector`                          | Server-seeded candidate evaluation, geometry/nav/occupancy/distance/reachability validation, visibility/reuse scoring and bounded failure                          |
| `ZombieEntityStore`                      | Monotonic IDs, generation revisions, bounded pooled entities and hitbox histories                                                                                  |
| `NavigationSystem`                       | Deterministic grid and connected components, bounded A*, path cache, collision-safe segments                                                                       |
| `TargetSelectionSystem`                  | Eligible connected/ready/living players, reachability, distance, distribution and hysteresis                                                                       |
| `ZombieAISystem` / `ZombieAttackSystem`  | Staggered decisions, steering, separation, stuck recovery, attack commitment, telegraph, resolution and cooldown                                                   |
| `DamageSystem`                           | Nearest head/body hit, bounded historical query, damage/stagger/death idempotency                                                                                  |
| `PlayerLifeStateSystem` / `ReviveSystem` | Health, downing, bleed-out, elimination, safe intermission return and server-timed hold interaction                                                                |
| `PvEReplicationSystem`                   | Bounded public snapshots and optional development metrics without paths, targets or match seeds                                                                    |

There is no ECS migration or new rendering, physics, navigation or network dependency. The fixed simulation remains 30 Hz, snapshots 15 Hz, target evaluation 5 Hz and nominal path updates 2.5 Hz. At most two path requests run in one simulation tick. Distant enemies request paths less often. The UI samples state at 10 Hz; zombie transforms never pass through React state.

## Arena and navigation

Map `quarantine-yard`, version **2**, references the original arena boxes, cover, divider, ramp, catwalk, beam, training plates and safe player spawns. North containment signs provide orientation. Spawn zones cover five perimeter regions with multiple approach directions.

The stack did not contain a navigation-mesh library. A bounded 1 m four-neighbor grid is appropriate for this 32 × 40 m arena. Version-controlled `NAVIGATION`, `ARENA_BOXES` and `ZOMBIE_SPAWN_ZONES` are the bake inputs. The server deterministically constructs at most 1,209 candidate grid cells, samples ramp/catwalk height, inflates obstacles for the largest archetype and rejects unsuitable headroom. No client builds paths or a navigation mesh. Geometry changes require a map-version bump and navigation tests.

Connected components answer reachability; reusable typed arrays bound A* searches to the node count. A 128-entry path cache is safe because geometry is static. Neighbor and movement segments are checked at 0.2 m intervals with a bounded vertical step. Ramp ascent is preserved. Per-archetype motion respects solid geometry and existing vertical surfaces. Local separation and collision rejection prevent zombie stacking. The two-player scene is small enough that bounded pairwise separation is cheaper and simpler than another spatial index.

Every 2.5 seconds, a chasing enemy checks progress. Lack of movement clears its path and target evaluation deadline and attempts a short, collision-valid retreat. It never teleports as normal recovery. Persistent navigation/spawn failures remain visible in development counters; exhausting 20 spawn searches transitions the run to a controlled error rather than dropping a planned enemy or looping forever.

Spawns evaluate at most 32 candidates. Candidates must lie in an allowed zone at navigation height, pass simplified geometry and Rapier spawn checks, avoid every retained player position by at least 8 m, be within 48 m of a reachable eligible player, and avoid living zombie colliders. Candidate score favors useful distance and subtracts large penalties for visible placement and recent reuse. Occlusion is preferred, not guaranteed if every otherwise valid region is visible. The match seed comes from server cryptographic randomness; tests may inject a deterministic seed directly into trusted constructors, never into a gameplay message.

## Waves and difficulty

`PREPARING → COUNTDOWN → ACTIVE → CLEARING → INTERMISSION → ACTIVE … → PHASE_COMPLETE`

`TEAM_DEFEATED`, `CANCELLED` and `ERROR` are terminal alternatives. Disconnect before countdown completion returns to `PREPARING`. The server waits for both expected clients to connect and report the correct map/version before unlocking the countdown. Transition revisions prevent duplicate announcements.

| Wave | Budget | Concurrent cap | Composition introduced   | Spawn interval | Health / damage / speed |
| ---- | -----: | -------------: | ------------------------ | -------------- | ----------------------- |
| 1    |      8 |              4 | Walker                   | 1.8–2.3 s      | 1 / 1 / 1               |
| 2    |     14 |              7 | Runner                   | 1.2–1.8 s      | 1 / 1 / 1               |
| 3    |     22 |             12 | Spitter                  | 0.8–1.4 s      | 1.05 / 1.05 / 1         |
| 4    |     32 |             18 | Brute                    | 0.65–1.1 s     | 1.1 / 1.1 / 1.03        |
| 5    |     44 |             24 | Screamer; all five types | 0.45–0.9 s     | 1.15 / 1.15 / 1.05      |

Budgets buy archetype scheduling cost internally; this is director configuration, not match currency. Guaranteed introductions are included before weighted selection. Startup validation checks exact wave numbering, costs, weights, duplicate types, special limits, intervals, caps and stat bounds. Intermissions last 12/14/16/18 seconds after Waves 1–4. Initial spawn delay is 1–2 seconds.

All base enemies must be scheduled, the queue empty and the authoritative living count zero before clearing. Reinforcements enter the same queue and concurrent cap and are counted separately. Any unused ability quota becomes unavailable once its living callers die; it is not an outstanding enemy. Wave 5 permits at most four reinforcement Walkers. Clearing Wave 5 stops simulation and never schedules Wave 6.

## Enemies and target policy

AI states are numeric: spawning, chasing, windup, recovery, staggered and dead. A transition table rejects impossible changes. Attacks have a committed target/aim point and cannot resolve twice.

| Archetype | Base HP / speed | Behavior                                                                                                                          |
| --------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Walker    | 65 / 1.7 m/s    | Predictable melee, 800 ms windup, 900 ms recovery, 14 damage                                                                      |
| Runner    | 45 / 3.8 m/s    | Bounded acceleration, 600 ms melee windup, lower stagger resistance, 11 damage                                                    |
| Spitter   | 70 / 1.9 m/s    | Seeks roughly 10 m separation, 1.2 s visible fixed aim-point windup, 16-damage ranged strike; moving sideways dodges it           |
| Brute     | 220 / 1.2 m/s   | Broad silhouette, 1.6 s heavy melee windup, 1.8 s recovery, 32 damage; ordinary enemy, no boss mechanics                          |
| Screamer  | 85 / 2 m/s      | Seeks roughly 8 m separation, 2.4 s scream telegraph; one two-Walker package, wave quota permitting; subsequently uses weak melee |

The Spitter uses a server-resolved ranged strike with a short visual tracer, not a persistent projectile or damage pool. The server revalidates target eligibility, range, vertical separation and static LOS after windup, then checks the committed aim line against the current player body. Melee revalidates range/LOS at resolution. Screamer calls are nonrecursive and cooldown limited. Telegraph events precede damage.

Targets must be connected, loaded, alive and inside the playable world. Downed, eliminated and disconnected players are excluded. Invalid targets are dropped immediately. Distance plus a small assignment penalty encourages distribution. A challenger must beat the retained target's distance by the 0.65 hysteresis factor. Initial evaluation and path deadlines are staggered. A two-player match can continue with one eligible living player.

## Rifle damage and compensation

Phase 4 owns shot sequence, cadence, magazine/reserve, reload, aim sanity, authoritative eye origin, spread and static-world raycasts. The client cannot send a trusted hit, damage, entity ID or hit region. Players are never valid rifle damage targets.

The server compares the nearest zombie head/body intersection with the existing nearest geometry/plate hit. One shot affects at most one entity. Base damage is 25, body multiplier 1, head multiplier 2. Health clamps to zero, death increments director accounting once and cancels attack state. The client displays confirmed hit/headshot/kill feedback only after `shotConfirmed`.

Each zombie retains at most 32 tick/position records in a typed ring. The client optionally supplies its estimated rendered `viewTick`, derived from server snapshots and the 100 ms interpolation offset. The server rejects future/impossibly old render ticks, clamps rewind to 200 ms and never accepts a time before that entity's retained spawn history. Missing `viewTick` uses current authority. Only the historical hit-test coordinates are queried; live entities and static geometry are never rewound or mutated. The cost is measured in diagnostics. This is deliberately a small PvE compensation system, not a PvP rollback architecture.

## Health, downing and revive

Life states are `ALIVE`, `DOWNED`, `ELIMINATED`. Connection/loading and active revival are orthogonal flags, avoiding duplicate state combinations. Lethal enemy damage downs the player at zero health, cancels reload, clears motion and starts a 30-second authoritative bleed-out. Weapons and normal movement are rejected; looking from the retained viewpoint remains possible. Downed players cannot self-revive or attract ordinary attacks. Bleed-out eliminates them.

Hold **E** within 2.4 m and with clear LOS to revive a loaded, connected, downed teammate. The server owns the five-second deadline. Repeated valid begin messages renew the hold lease without resetting progress; the client sends a keep-held intent every 250 ms. A 750 ms lease prevents a lost key-up or stalled tab from completing a revive indefinitely. Ordered interaction sequences reject stale starts/cancels and peers cannot act for another connection.

Release, range/height/LOS failure, target bleed-out, either disconnect, downing the reviver, lost hold lease or leaving active combat cancels the interaction. Successful completion restores 45% health, clears bleed-out and applies 1.8 seconds of protection, once. Reviving disables firing and cancels reload. Progress is displayed from server start/end time, not supplied by the client.

At an intermission, a connected eliminated or downed teammate returns at a navigation/physics-valid safe player spawn, away from the other player's collider, with full health and brief protection. Return is idempotent. The magazine is preserved; the existing rifle's reserve is raised to at least 120 and reload is cancelled. Living players receive the same reserve resupply. This documented free between-wave rule prevents the five-wave run from becoming ammunition-starved without introducing a shop, item, loot or economy system. Reconnect alone never restores ammunition or health.

## Reconnect, defeat and lifecycle persistence

Missing players retain health, life, weapon and bleed-out state during the existing 30-second grace. Their inputs and revive are cancelled and they are not enemy targets or combat shields. The living teammate may continue. Grace expiry eliminates the missing player; it no longer automatically ends a match with a living survivor.

If no loaded living player remains but a living teammate can still reconnect within grace, `recoveryPending` freezes AI/combat and advances downed deadlines by the paused duration. It is bounded by the original disconnect deadline; reconnecting without completing scene readiness does not extend it. Readiness restores recovery, and expiry without a viable reviver defeats the team. Both downed, downed plus eliminated, or both eliminated defeats immediately.

Welcome contains the complete current wave, queue summary, all relevant zombie generations/poses/health/presentation states, players/life/bleed/protection, revive state, weapon ammunition/reload and event watermark. Client prediction and zombie pools/interpolation reset on reconnect. A process crash still ends the reservation rather than reconstructing per-tick state from a database.

Defeat and completion stop spawns, AI and revival, send the final authoritative snapshot and transition the existing match lifecycle to `ENDED`. The existing signed callback optionally carries `{result, reason, completedWaves}`. The existing `Match.gameplay` JSON stores this small terminal outcome with `COMPLETED` status; cancellations/expired leases retain the existing `ABORTED` behavior. Room cleanup and outcome recording are atomic/idempotent. No migration or gameplay-state persistence is added. Expired match resources are disposed after the existing 45-second retention delay.

## Protocol and presentation lifecycle

Protocol **v2** and map **v2** must deploy together. Existing signed envelopes also use v2. Added intents: `beginRevive(targetId, seq)` and `cancelRevive(seq)`; fire optionally includes `viewTick`. Added messages: compact `pveEvent` and revisioned `waveStateChanged`. World snapshots include a bounded PvE aggregate. Shot confirmation optionally includes zombie ID/revision, head/body region and kill confirmation. No entire-world payload is sent for an individual damage/telegraph event.

Events use a monotonic watermark; snapshots reject old ticks and wave revisions. Reconnect resets interpolation using the watermark. The 4 KB client-message limit, exact membership/connection checks, strict schemas, rate/queue budgets, slow-peer disconnection and 32 KB client server-frame ceiling remain. Snapshots allow at most 48 live/death-presentation entities and two players. AI paths, target selection and seeds are absent from public snapshots.

The client preallocates 48 procedural pose hierarchies. Four instanced batches submit bodies/limbs, heads, warning rings and special crests; label sprites share five textures. Fixed instance indices map to presentation slots, while every rigid limb keeps its own animation transform. This reduces GPU submissions without changing authoritative identification or hitboxes. Empty slots submit zero-scale matrices. Each reused slot clears ID/revision, transforms, bounded history, damage/telegraph timers and generation-dependent pose/color/label state. Server entity reuse likewise clears targets, paths, attack/ability state and 32-record history. Death presentation lasts 900 ms; authoritative membership handles final removal. Transform interpolation is 100 ms behind authority, extrapolation stops at 100 ms and large corrections reset history. Distant models use static limbs and omit labels; labels also disappear within three metres to avoid covering the view. Frequent impact/tracer effects reuse the Phase 4 pool.

Audio is original Web Audio synthesis. Cues cover movement, attack/impact/death, each special telegraph, damage/downing, revive, waves and terminal states. World sounds use positional panners, nearby filtering, identical-sound limits and reserved capacity for important cues. Master volume and existing reduced motion/camera/flash preferences are retained. Audio nodes, textures, geometry, renderer pools, timers and listeners are disposed on exit. No third-party asset licenses or downloads were introduced.

## Extension boundaries

Future phases can provide new validated director configurations, authored models and animation, a larger-map navmesh implementation behind navigation boundaries, and a more compact replication encoding. The current extension points do not implement an economy, weapons/upgrades, objectives, bosses, rewards or persistent progression. See the verification record for measured performance and outstanding hardware/manual validation limits.
