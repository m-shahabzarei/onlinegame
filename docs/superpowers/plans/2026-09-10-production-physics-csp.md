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
- [ ] Add `'wasm-unsafe-eval'` to `script-src`; retain development-only `'unsafe-eval'`.
- [ ] Add a production browser regression that compiles an empty valid WASM module and verifies JavaScript eval remains blocked.
- [ ] Run formatting and typecheck, commit and push to trigger Vercel deployment.
- [ ] Verify the deployed header, run the browser regression and two-player production smoke, and document results and free-tier cold starts.
