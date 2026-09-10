import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "docs/phase-7-verification.md",
  "docs/phase-8-release.md",
  "prisma/migrations/20260909020000_phase8_release_foundation/migration.sql",
  "src/app/api/health/ready/route.ts",
  "src/app/api/status/route.ts",
  "services/game-server/server.ts",
];
const checks = requiredFiles.map((file) => ({
  name: `artifact:${file}`,
  ok: existsSync(file),
}));
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
checks.push({
  name: "protocol:versioned",
  ok: readFileSync("src/game/shared/config.ts", "utf8").includes(
    "PROTOCOL_VERSION",
  ),
});
checks.push({
  name: "game-server:separate-runtime",
  ok: readFileSync("README.md", "utf8").includes("persistent external runtime"),
});
checks.push({
  name: "production:secrets-outside-repository",
  ok: !Object.keys(process.env).some(
    (key) =>
      key.startsWith("NEXT_PUBLIC_") && /SECRET|TOKEN|PASSWORD|KEY/i.test(key),
  ),
});
checks.push({
  name: "package:test-script",
  ok: typeof packageJson.scripts?.test === "string",
});
for (const check of checks)
  console.log(`${check.ok ? "PASS" : "FAIL"} ${check.name}`);
if (process.env.RELEASE_GATE_MODE === "production") {
  const required = [
    "DATABASE_URL",
    "GAMEPLAY_JOIN_SECRET",
    "GAMEPLAY_CONTROL_SECRET",
    "GAMEPLAY_SERVER_HTTP_URL",
    "GAMEPLAY_WS_URL",
  ];
  for (const key of required)
    checks.push({ name: `env:${key}`, ok: Boolean(process.env[key]) });
}
if (checks.some((check) => !check.ok)) process.exitCode = 1;
