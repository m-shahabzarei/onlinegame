# Shop, combat, and localization verification

Date: 2026-09-10. Implementation and verification were performed in the existing workspace. No dependency or database migration was added.

## Root causes and changes

- The intermission callback was only reached for terminal waves; ordinary cleared waves could not open the authoritative shop. Solo also used a 500 ms test profile. Both player-facing modes now use the production profile and a shared 30-second deadline (server-only configuration: 10–60 seconds).
- Shop visibility depended on pointer lock. Availability now comes from the authoritative intermission/deadline, while the local dialog releases pointer lock and suspends player intent. B reopens it, Escape closes it, Return to arena requests pointer lock through a user gesture, and expiry closes it on both sides.
- Ownership, selected weapons, and combat used separate state. The per-weapon loadout now owns ammunition, upgrades, sequences, reload completion, and cooldowns. The legacy player weapon field projects the selected ammunition object. Shots, zombie hits, damage, reloads, prediction, HUD, models, and sound all resolve the selected weapon's stats.
- Purchases used a generic capacity check and generic gameplay errors. The server now validates explicit primary/secondary selection, replacement confirmation, ownership, life/match state, sequence/rate limits, deadlines, capacities, and request receipts. Semantic shop result codes are localized at the UI boundary.
- Combat rewards were disconnected from the shop economy. Effective damage, unique kills, and unique cleared waves now award authoritative Scrap, Score, and Contribution. Event receipts prevent duplicate rewards and spending.
- UI prose and runtime sentences bypassed the translation catalog. The app now uses one typed translator with matching English/Persian trees, typed parameters, plural rules, and cached Intl formatting. The catalog contains **984 string leaves per locale**. Missing keys and parameters fail explicitly.
- Authenticated switching previously updated only the lower-priority cookie. It now saves User.locale and the cookie together, invalidates the App Router tree, and exposes localized pending/failure states. Resolution remains explicit preference → authenticated user → cookie → English.
- Zombie nameplates also contained English in canvas textures. Their labels now use the same catalog and local Persian font; the existing textures are repainted on locale changes.

## Protocol and inventory rules

Deploy web and game server together using **protocol 3**. Older peers/tickets are incompatible. Next.js/client remain on Vercel; the authoritative Node/WebSocket service remains separate.

AR-01 starts in primary. PX-9 is secondary; Viper, Breach, and Atlas are primary. Ownership persists for the run across all five weapons, with one selected weapon in each slot. Purchases automatically select/equip the new weapon. Replacing a selected primary requires confirmation and retains the old weapon and ammo. Owned weapons remain selectable through Equip. Digit1/2 switch slots. Switching cannot bypass reloads or cooldowns; draw delay is 250 ms. Reconnect restores the complete loadout and sequence/cooldown state.

A normal first-wave solo clear can earn 182 Scrap; evenly shared co-op rewards give 121 each. PX-9 costs 120. Ammo refill replenishes the selected owned weapon's reserve; upgrades change live combat. Armor, medkits, grenades, sentries, gates, and objective interactions remain explicitly unavailable and never deduct Scrap.

## Localization and accessibility coverage

Navigation, catalog/details, authentication/guest onboarding, profile/settings/history, challenges/cosmetics/safety, rooms/invitations/readiness, gameplay loading/errors/HUD/dialogs, waves/revival/warnings, shop, objectives/boss/results, metadata, and accessible labels use the shared catalog. Server/protocol identifiers remain English codes. Source audits reject direct JSX prose, accessibility strings, inline language branches, and low-level render-label/error prose.

The root supplies matching lang/dir and locale context. Existing local Vazir files provide weights 100/300/400/500/700; English fonts are preserved. Logical positioning, readable technical tokens, focus rings, 44 px controls, Radix focus trapping/restoration, and polite live feedback are retained.

## Verification record

| Check                                        | Result                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Full unit suite, one worker                  | Passed: 332 tests; 3 PostgreSQL integration tests skipped without a configured test database            |
| Focused authoritative combat suite           | Passed: 19 tests, including every purchased/upgraded weapon through real match fire and reload commands |
| Game suite                                   | Passed: 142 tests; 1 database integration test skipped                                                  |
| PvE suite                                    | Passed: 52 tests                                                                                        |
| Type check                                   | Passed                                                                                                  |
| Game server build                            | Passed                                                                                                  |
| Production Next.js build                     | Passed                                                                                                  |
| Lint / formatting                            | Passed                                                                                                  |
| Browser: English solo shop/combat/reconnect  | Passed on final client                                                                                  |
| Browser: Persian co-op shop/combat/reconnect | Passed on final client, including all four widths and localized canvas nameplates                       |
| Browser: guest language persistence          | Passed, including same-document navigation and first Persian server render                              |
| Browser: authenticated preference            | Passed, including durable user preference winning over a conflicting cookie                             |
| Browser: Persian routes/fonts/layout         | Passed at 375, 768, 1024, and 1440 px for catalog, game details, login, and registration                |

Browser combat tests use a private, loopback-only test harness that arranges enemies and protects players. They assert the initial 30-second window before extending the existing intermission solely for slower responsive screenshots; an explicit authoritative deadline fixture checks expiry. Real client shots earn the rewards; purchase/equip/reload commands and reconnect use the normal server. Native Web Audio calls are observed for distinct rifle/pistol/reload cues. Fixtures are excluded from the production game build.

Manual solo verification in Chrome completed room creation, readiness, a real eight-kill wave, the 182 → 62 Scrap purchase, auto-equip, pointer lock, Digit1/2, a held semi-automatic press, reload to 12/71, and real socket reconnection with unchanged ammunition.

Manual co-op verification used separate Chrome and Edge processes and the Persian UI. Chrome created a private room through the rendered controls; Edge joined with the invite-code form; both readied, entered the same match, and acquired pointer lock. Real AR-01 shots cleared the eight-zombie first wave and earned 182 Scrap for the firing player. The 120-Scrap PX-9 purchase auto-equipped the secondary slot and left 62 Scrap. Its held trigger fired once, the server confirmed the hit, reload restored 12/71, and a real socket closure/reconnect restored ownership, slots, upgrades, exact ammunition, and PX-9 selection while both players returned to `PLAYING`. The lobby, arena, shop, technical tokens, procedural models, and localized zombie nameplates were visually inspected.

An initial test run exhausted host memory; another lost OS temporary module files. The clean full-suite rerun used a workspace-local temporary directory. Three bounded physics/network simulations were given 15-second test timeouts for shared CI hosts; their gameplay timing and assertions were not changed.

## Main implementation files

- `services/game-server/match.ts`, `phase6.ts`, `pve/damage.ts`, `pve/simulation.ts`, `pve/waves.ts`, configuration and regression tests.
- `src/game/shared/phase6.ts`, `weapon.ts`, `protocol.ts`, `physics.ts`, `config.ts` and shared tests.
- `src/game/client/runtime.ts`, `input.ts`, `rendering.ts`, `zombies.ts`, `audio.ts`, `network.ts`, `messages.ts`, `pve-hud.ts` and client tests.
- `src/components/game/game-shell.tsx`, `phase6-shop.tsx`, `game.module.css`, shop tests, and shared dialog/button primitives.
- `src/i18n/core.ts`, `index.ts`, `client.ts`, `provider.tsx`, `messages.ts`, feature catalogs, semantic error/catalog helpers, `font.ts`, parity/request-locale/source-audit tests.
- `src/server/actions/locale.ts`, authentication/action presentation, language switcher and tests; localized rendered routes and components throughout `src/app` and `src/components`.
- `e2e/shop.spec.ts`, `localization.spec.ts`, `pve-harness.mjs`, related version fixtures/scripts, `.env.example`, and the shop/Phase 6 documentation.

## Performance and limits

Weapon view models are created once, share geometry/materials, and switch visibility. Remote weapon models reuse the same resources. Zombie rendering remains instanced, nameplates reuse five textures, and resolved stats/Intl formatters are cached. No geometry/material allocation was added to the frame loop; cleanup remains explicit.

An offline server profile with 24 zombies and 9,000 measured ticks reported mean 4.97 ms, p95 9.90 ms, p99 19.42 ms, approximately 19–20 MB heap, and a maximum 10,026-byte snapshot under concurrent host load. This is server evidence, not a browser 60 FPS measurement. Software-rendered browser tests do not establish a hardware FPS guarantee or substitute for a listening review.

Unavailable support/map items are intentional and clearly marked. The final boss is an authoritative pooled brute with two phases; bespoke boss models/ranged/reinforcement attacks and separate mini-boss content are not implemented. Reconnect preservation applies to the running authoritative process; process restart still ends active matches. Production PostgreSQL integration needs its configured test database.
