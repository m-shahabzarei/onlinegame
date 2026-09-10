# Phase 6 development

Run `npm install`, then `npm run typecheck`, `npm test`, `npm run test:game`, `npm run game:build`, and `npm run build`. The web app uses the existing environment variables documented in `docs/phase-4-development.md`; the gameplay server still requires its join/control secrets, web URL, origin list, and persistent runtime. Set the PvE profile through the server `pve` options (`profile: "phase6-production"` or `"phase5-test"`).

Deploy web and game server together using protocol **3**. Both player-facing modes use `phase6-production`; `phase5-test` is for isolated injected tests. Optional server-only `GAMEPLAY_INTERMISSION_MS` configures 10–60 seconds (default 30). See [shop and combat](shop-and-combat.md) for the current implemented and unavailable content.

The Safe Room is represented by the authoritative shop deadline. The localized client releases pointer lock and opens a focus-trapped dialog. B reopens it until expiry; Return to arena reacquires pointer lock through a user gesture. Purchases are intents and only accepted snapshots update the loadout. Digit1/2 switch primary/secondary. The HUD, procedural models, sound cues, rays, damage, ammo, and reloads use the selected weapon and upgrades.

For a two-client smoke run, reserve a room with two authorized participants, open both `/play/:matchId` pages in separate desktop browser contexts, clear a wave, purchase PX-9 for 120 Scrap, switch weapons, reload, and reconnect. Repeat in Persian. `e2e/shop.spec.ts` uses the isolated `NODE_ENV=test`, `PVE_SHOP_TEST=1` harness; its private loopback fixtures arrange enemies while real client fire earns rewards. No fixture handler ships in the gameplay build. Do not use local storage as an economy source.
