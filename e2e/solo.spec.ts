import { test, expect } from "@playwright/test";

test("one browser can start Nightfall Protocol in solo mode", async ({
  page,
  baseURL,
}) => {
  test.skip(
    !process.env.PVE_FIXTURE_KEY,
    "Run the isolated local PvE harness for deterministic authority fixtures",
  );
  if (!baseURL) throw new Error("Test base URL required");
  await page.goto(
    "/continue-as-guest?next=%2Fgames%2Fnightfall-protocol%2Frooms",
  );
  await page
    .getByRole("button", { name: "Continue as guest", exact: true })
    .click();
  await expect(page).toHaveURL(/\/games\/nightfall-protocol\/rooms/);
  const roomResponse = await page.request.post("/api/lobby?op=command", {
    headers: { Origin: baseURL },
    data: {
      requestId: crypto.randomUUID(),
      type: "create",
      slug: "nightfall-protocol",
      visibility: "PRIVATE",
      mode: "solo",
    },
  });
  expect(roomResponse.ok()).toBe(true);
  const room = (await roomResponse.json()).data;
  await page.goto(`/rooms/${room.code}`);
  await page.getByRole("button", { name: "I’m Ready", exact: true }).click();
  await page.getByRole("button", { name: "Start Game", exact: true }).click();
  await expect(page).toHaveURL(/\/play\//);
});
