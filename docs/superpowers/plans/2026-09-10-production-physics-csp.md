# Production physics CSP implementation plan

**Goal:** Let the production game's bundled Rapier WebAssembly physics initialize.

**Architecture:** Add the WebAssembly-specific permission to the shared script policy, since client navigation retains the document's original CSP. Keep JavaScript eval blocked in production.

**Tech stack:** Next.js 16.3.4, Rapier, CSP, Playwright.

## Constraints

- Read installed Next.js CSP documentation before editing configuration (completed).
- Preserve origin restrictions, frame restrictions, TLS enforcement, and production JavaScript eval protection.
- Use the existing authorized Vercel and Render deployments; no paid resources.

## Task: Enable bundled physics and verify production

Files: `next.config.ts`, `e2e/csp.spec.ts`, `docs/vercel-deployment.md`.

- [x] Reproduce using production Chrome: WebGL 2 succeeds, `WebAssembly.compile()` is rejected by `script-src`.
- [x] Add `'wasm-unsafe-eval'` to `script-src`; retain development-only `'unsafe-eval'`.
- [x] Add a production browser regression that compiles an empty valid WASM module and verifies the policy keeps JavaScript eval blocked.
- [x] Run formatting and typecheck, commit and push to trigger Vercel deployment (`812bda7`).
- [x] Verify the deployed header and run the production CSP regression (passed).
- [x] Run two-player production protocol smoke: guests, room, readiness, PLAYING, reconnect with the same identity, and cooperative leave all passed.
- [x] Verify browser rendering, movement visible to the second player, and authoritative ammunition changes. Full browser reload stability remains unverified: software-rendered browser runs experienced reconnects and duplicate-slot errors. This is recorded as a limitation, not a passing full browser smoke.
