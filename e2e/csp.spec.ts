import { test, expect } from "@playwright/test";

test("production policy permits WASM physics while blocking JavaScript eval", async ({
  page,
  baseURL,
}) => {
  test.skip(!baseURL?.startsWith("https://"), "Production CSP requires HTTPS");
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  const policy = response?.headers()["content-security-policy"] ?? "";
  const scriptSources = policy
    .split(";")
    .find((directive) => directive.trim().startsWith("script-src "))
    ?.trim()
    .split(/\s+/);
  // DevTools evaluation can bypass JavaScript eval checks, so inspect its policy.
  expect(scriptSources).not.toContain("'unsafe-eval'");
  const wasm = await page.evaluate(async () => {
    try {
      await WebAssembly.compile(new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0]));
      return true;
    } catch {
      return false;
    }
  });
  expect(wasm).toBe(true);
});
