# Phase 4 file manifest

The initial temporary SHA256 manifest was no longer available after the disk-space incident. This comparison uses the initial source verification copy made before gameplay/lobby edits, excluding Phase 4 files already created at that point. Package manifests are included as modified because dependency selection had begun before that copy.

## Created (52 files)

- `docs/phase-4-architecture.md`
- `docs/phase-4-development.md`
- `docs/phase-4-files.md`
- `docs/phase-4-verification.md`
- `docs/superpowers/plans/2026-09-08-phase-4-fps.md`
- `e2e/gameplay.spec.ts`
- `playwright.config.ts`
- `prisma/migrations/20260908010000_phase4_gameplay/migration.sql`
- `scripts/profile-gameplay.mjs`
- `services/game-server/Dockerfile`
- `services/game-server/config.ts`
- `services/game-server/main.ts`
- `services/game-server/match.test.ts`
- `services/game-server/match.ts`
- `services/game-server/network-conditions.test.ts`
- `services/game-server/server.integration.test.ts`
- `services/game-server/server.ts`
- `services/game-server/tsconfig.json`
- `src/app/api/gameplay/[matchId]/route.ts`
- `src/app/api/gameplay/internal/route.ts`
- `src/app/api/gameplay/sweep/route.ts`
- `src/app/play/[matchId]/error.tsx`
- `src/app/play/[matchId]/loading.tsx`
- `src/app/play/[matchId]/page.tsx`
- `src/components/game/game-shell.tsx`
- `src/components/game/game.module.css`
- `src/game/client/audio.ts`
- `src/game/client/input.ts`
- `src/game/client/network.ts`
- `src/game/client/network.test.ts`
- `src/game/client/rendering.ts`
- `src/game/client/runtime.ts`
- `src/game/client/runtime.test.ts`
- `src/game/shared/arena.ts`
- `src/game/shared/config.ts`
- `src/game/shared/game.test.ts`
- `src/game/shared/lifecycle.ts`
- `src/game/shared/physics.ts`
- `src/game/shared/prediction.ts`
- `src/game/shared/protocol.ts`
- `src/game/shared/settings.ts`
- `src/game/shared/time.ts`
- `src/game/shared/tokens.ts`
- `src/game/shared/weapon.ts`
- `src/server/gameplay/config.ts`
- `src/server/gameplay/http.test.ts`
- `src/server/gameplay/http.ts`
- `src/server/gameplay/index.ts`
- `src/server/gameplay/prisma.integration.test.ts`
- `src/server/gameplay/service.test.ts`
- `src/server/gameplay/service.ts`
- `vercel.json`

## Modified (15 files)

- `.env.example`
- `.gitignore`
- `README.md`
- `eslint.config.mjs`
- `package-lock.json`
- `package.json`
- `prisma/schema.prisma`
- `src/components/lobby/room-lobby.test.tsx`
- `src/components/lobby/room-lobby.tsx`
- `src/domain/lobby.ts`
- `src/server/lobby/prisma-store.ts`
- `src/server/lobby/room-service.ts`
- `src/server/lobby/store.ts`
- `tsconfig.json`
- `vitest.config.ts`

## Deleted original files

None.
