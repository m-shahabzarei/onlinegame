import { existsSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

import type { NextConfig } from "next";

const projectRoot = process.cwd();
const defaultDistDir = resolve(projectRoot, ".next");

function isOutsideProject(path: string) {
  if (!existsSync(path)) {
    return false;
  }

  const relativePath = relative(projectRoot, realpathSync(path));

  return (
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  );
}

// Next requires distDir to remain inside the project. In local Codex previews,
// .next can be a cross-drive junction whose server chunks cannot resolve this
// project's dependencies, so use an ordinary in-project directory instead.
const useLocalBuild =
  process.env.TWOPLAYER_LOCAL_BUILD === "1" || isOutsideProject(defaultDistDir);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  distDir: useLocalBuild ? ".next-local" : ".next",
  // Retain warmed local test routes while two browser contexts traverse the flow.
  ...(useLocalBuild
    ? { onDemandEntries: { maxInactiveAge: 600000, pagesBufferLength: 16 } }
    : {}),
  // Loopback-only second cookie jar for local two-player QA. No production effect.
  allowedDevOrigins: ["127.0.0.1"],
  outputFileTracingRoot: process.cwd(),
  async headers() {
    const isProduction = process.env.NODE_ENV === "production";
    const connectSources = ["'self'", "ws:", "wss:"];
    const csp = [
      "default-src 'self'",
      // App Router hydration uses inline scripts; Rapier physics requires WASM.
      // The WASM permission does not enable JavaScript eval in production.
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'" +
        (isProduction ? "" : " 'unsafe-eval'"),
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src ${[...connectSources, "https:"].join(" ")}`,
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      ...(isProduction ? ["upgrade-insecure-requests"] : []),
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          ...(isProduction
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
