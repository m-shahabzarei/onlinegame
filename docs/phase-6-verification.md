# Phase 6 verification

Automated coverage includes wallet bounds and arithmetic, stat resolution, explicit five/ten-wave profiles, two-phase boss definitions, atomic/idempotent purchases, gate prerequisites, boss victory, protocol parsing, and the existing Phase 5 suite. Run:

```text
npm run typecheck
npm test
npm run test:game
npm run game:build
npm run build
npm run db:validate
```

Manual verification should use two desktop clients and check shop timer closure, synchronized purchases and gate state, objective progress/reward-once behavior, boss health/phase replication, victory/defeat summaries, and reconnect restoration. Performance diagnostics remain development-only and reuse the existing `scripts/profile-pve.mjs` and `scripts/profile-gameplay.mjs`; no Phase 7 load-testing infrastructure was added.
