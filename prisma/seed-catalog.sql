-- Explicit deployment seed. Re-running never modifies an existing game,
-- including an operator's maintenance or archived status.
INSERT INTO "Game" (
  "id", "slug", "name", "description", "status", "maxPlayers", "updatedAt"
)
VALUES (
  'game-nightfall-protocol',
  'nightfall-protocol',
  'Nightfall Protocol',
  'A cinematic two-player cooperative first-person zombie survival shooter built around trust, timing, and team progression.',
  'ACTIVE',
  2,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
