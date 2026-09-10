// Vitest runs server-only modules in a Node/jsdom test process. Next.js still
// enforces the real `server-only` marker in production bundles; this shim only
// prevents the package's intentional client-component throw during tests.
export {};
