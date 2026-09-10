# Phase 6 development

Run `npm install`, then `npm run typecheck`, `npm test`, `npm run test:game`, `npm run game:build`, and `npm run build`. The web app uses the existing environment variables documented in `docs/phase-4-development.md`; the gameplay server still requires its join/control secrets, web URL, origin list, and persistent runtime. Set the PvE profile through the server `pve` options (`profile: "phase6-production"` or `"phase5-test"`).

The Safe Room is represented by the authoritative shop timer in the phase6 snapshot. The client renders the keyboard-accessible shop overlay, Scrap/Score/Contribution, armor and support quantities, objective status, and boss bar using the established design tokens. Purchases are sent as intents and only accepted snapshots update the UI.

For a two-client smoke run, reserve a room with two authorized participants, open both `/play/:matchId` pages in separate desktop browser contexts, clear waves using the existing accelerated fixture when testing locally, and verify purchase, gate, objective, mini-boss, boss, victory, and reconnect snapshots. Do not use local storage as an economy source.
