import { test, expect, type Page, type WebSocket } from "@playwright/test";
import type { ServerMessage, WorldSnapshot } from "../src/game/shared/protocol";
test("two authenticated browser contexts enter, move, fire, reload, reconnect and leave", async ({
  browser,
  baseURL,
}, testInfo) => {
  if (!baseURL) throw new Error("A local test base URL is required");
  const contexts = await Promise.all([
    browser.newContext({ baseURL, viewport: { width: 1280, height: 720 } }),
    browser.newContext({ baseURL, viewport: { width: 1920, height: 1080 } }),
  ]);
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const latest: (WorldSnapshot | undefined)[] = [undefined, undefined];
  const playerIds = ["", ""];
  const connections = [0, 0];
  const activeSockets: (WebSocket | undefined)[] = [undefined, undefined];
  const errors: string[] = [];
  pages.forEach((page, index) => {
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("websocket", (socket) => {
      if (!socket.url().includes("/gameplay")) return;
      connections[index] = (connections[index] ?? 0) + 1;
      socket.on("framereceived", (event) => {
        const message = JSON.parse(event.payload.toString()) as ServerMessage;
        if (message.type === "welcome") {
          activeSockets[index] = socket;
          playerIds[index] = message.playerId;
          latest[index] = message.snapshot;
        }
        if (message.type === "worldSnapshot") latest[index] = message.snapshot;
      });
    });
  });
  async function guest(page: Page) {
    await page.goto(
      "/continue-as-guest?next=%2Fgames%2Fnightfall-protocol%2Frooms",
    );
    await page
      .getByRole("button", { name: "Continue as guest", exact: true })
      .click();
    await expect(page).toHaveURL(/\/games\/nightfall-protocol\/rooms/);
  }
  async function command(slot: number, data: Record<string, unknown>) {
    const response = await contexts[slot]!.request.post(
      "/api/lobby?op=command",
      {
        headers: { Origin: baseURL! },
        data: { requestId: crypto.randomUUID(), ...data },
      },
    );
    expect(response.ok()).toBe(true);
    return (await response.json()).data;
  }
  try {
    // Compile protected development routes before a live reservation starts,
    // and verify that neither boundary accepts an unauthenticated request.
    const rejectedCallback = await contexts[0]!.request.post(
      "/api/gameplay/internal",
      { data: "invalid" },
    );
    expect(rejectedCallback.status()).toBe(403);
    const rejectedBootstrap = await contexts[0]!.request.post(
      "/api/gameplay/preflight",
      {
        headers: { Origin: baseURL },
        data: { action: "bootstrap" },
      },
    );
    expect(rejectedBootstrap.status()).toBe(403);
    await contexts[0]!.request.get("/play/preflight");
    for (const page of pages) await guest(page);
    const created = await command(0, {
      type: "create",
      slug: "nightfall-protocol",
      visibility: "PRIVATE",
    });
    await command(1, { type: "join", code: created.code });
    for (const page of pages) await page.goto(`/rooms/${created.code}`);
    for (const page of pages) {
      await expect(
        page.getByRole("button", { name: "I’m Ready", exact: true }),
      ).toBeEnabled();
      await page
        .getByRole("button", { name: "I’m Ready", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Set Not Ready", exact: true }),
      ).toBeVisible();
    }
    await expect(
      pages[0]!.getByRole("button", { name: "Start Game", exact: true }),
    ).toBeEnabled();
    await pages[0]!
      .getByRole("button", { name: "Start Game", exact: true })
      .click();
    for (const page of pages) await expect(page).toHaveURL(/\/play\//);
    expect(new URL(pages[0]!.url()).pathname).toBe(
      new URL(pages[1]!.url()).pathname,
    );
    // Keep this Phase 4 regression focused on movement/settings/reconnect while the
    // dedicated PvE browser test validates damage, downing and recovery.
    if (process.env.PVE_FIXTURE_KEY) {
      const matchId = new URL(pages[0]!.url()).pathname.split("/").at(-1)!;
      await expect
        .poll(async () =>
          (
            await contexts[0]!.request.post("http://127.0.0.1:8092", {
              headers: {
                Authorization: `Bearer ${process.env.PVE_FIXTURE_KEY}`,
              },
              data: { action: "protect", matchId },
            })
          ).status(),
        )
        .toBe(200);
    }
    for (const page of pages)
      await expect(
        page.getByRole("button", { name: "Enter arena", exact: true }),
      ).toBeVisible();
    await expect
      .poll(() => latest.every((s) => s?.state === "PLAYING"))
      .toBe(true);
    expect(playerIds[0]).not.toBe(playerIds[1]);
    const a = pages[0]!,
      b = pages[1]!;
    await a.bringToFront();
    await a.getByRole("button", { name: "Enter arena", exact: true }).click();
    await expect
      .poll(() => a.evaluate(() => document.pointerLockElement?.tagName))
      .toBe("CANVAS");
    const x = latest[1]!.players.find((p) => p.id === playerIds[0])!.position.x;
    await a.keyboard.down("KeyD");
    await expect
      .poll(
        () =>
          latest[1]?.players.find((p) => p.id === playerIds[0])?.position.x ??
          x,
      )
      .toBeGreaterThan(x + 0.5);
    await a.keyboard.up("KeyD");
    await a.mouse.down();
    await expect
      .poll(
        () =>
          latest[0]?.players.find((p) => p.id === playerIds[0])?.weapon
            .magazine ?? 30,
      )
      .toBeLessThan(30);
    await a.mouse.up();
    await a.keyboard.press("KeyR");
    await expect
      .poll(
        () =>
          latest[0]?.players.find((p) => p.id === playerIds[0])?.weapon
            .reloadAt ?? 0,
      )
      .toBeGreaterThan(0);
    await expect
      .poll(
        () =>
          latest[0]?.players.find((p) => p.id === playerIds[0])?.weapon
            .magazine,
      )
      .toBe(30);
    const weapon = latest[0]!.players.find(
      (p) => p.id === playerIds[0],
    )!.weapon;
    await a.keyboard.press("Escape");
    await expect
      .poll(() => a.evaluate(() => document.pointerLockElement === null))
      .toBe(true);
    await a.getByRole("button", { name: "Settings", exact: true }).click();
    await a
      .getByRole("checkbox", { name: "Reduce camera motion and weapon bob" })
      .check();
    await a
      .getByRole("checkbox", { name: "Network and performance diagnostics" })
      .check();
    await a.keyboard.press("Escape");
    await expect(a.getByRole("dialog")).not.toBeVisible();
    await expect(a.getByLabel("Game diagnostics")).toBeVisible();
    await testInfo.attach("720p-diagnostics", {
      body: await a.getByLabel("Game diagnostics").innerText(),
      contentType: "text/plain",
    });
    console.log(
      "BROWSER_DIAGNOSTICS",
      await a.getByLabel("Game diagnostics").innerText(),
    );
    await a.getByRole("button", { name: "Enter arena", exact: true }).click();
    await expect
      .poll(() => a.evaluate(() => document.pointerLockElement?.tagName))
      .toBe("CANVAS");
    await a.keyboard.press("Space");
    await expect
      .poll(
        () => latest[0]?.players.find((p) => p.id === playerIds[0])?.grounded,
      )
      .toBe(false);
    await expect
      .poll(
        () => latest[0]?.players.find((p) => p.id === playerIds[0])?.grounded,
      )
      .toBe(true);
    await a.keyboard.down("KeyC");
    await expect
      .poll(
        () => latest[0]?.players.find((p) => p.id === playerIds[0])?.crouched,
      )
      .toBe(true);
    await a.keyboard.up("KeyC");
    await expect
      .poll(
        () => latest[0]?.players.find((p) => p.id === playerIds[0])?.crouched,
      )
      .toBe(false);
    await a.screenshot({ path: testInfo.outputPath("arena-720p.png") });
    await a.keyboard.down("KeyD");
    await a.evaluate(() => window.dispatchEvent(new Event("blur")));
    await a.keyboard.up("KeyD");
    await expect
      .poll(
        () => latest[0]?.players.find((p) => p.id === playerIds[0])?.velocity.x,
      )
      .toBe(0);
    await b.bringToFront();
    await b.getByRole("button", { name: "Enter arena", exact: true }).click();
    await expect
      .poll(() => b.evaluate(() => document.pointerLockElement?.tagName))
      .toBe("CANVAS");
    await b.screenshot({ path: testInfo.outputPath("arena-1080p.png") });
    await b.keyboard.press("Escape");
    await a.bringToFront();
    const contextExtension = await a
      .locator("canvas")
      .evaluateHandle((element) =>
        (element as HTMLCanvasElement)
          .getContext("webgl2")!
          .getExtension("WEBGL_lose_context")!,
      );
    await contextExtension.evaluate((extension) => extension.loseContext());
    await expect(
      a.getByRole("heading", { name: "Restoring graphics" }),
    ).toBeVisible();
    await contextExtension.evaluate((extension) => extension.restoreContext());
    await expect(
      a.getByRole("button", { name: "Enter arena", exact: true }),
    ).toBeVisible();
    await contextExtension.dispose();
    // A reload tears down the old socket and bootstraps a fresh one with the same session.
    const before = connections[0]!;
    await a.reload();
    await expect.poll(() => connections[0]).toBeGreaterThan(before);
    await expect(
      a.getByRole("button", { name: "Enter arena", exact: true }),
    ).toBeVisible();
    expect(
      latest[0]!.players.find((p) => p.id === playerIds[0])!.weapon,
    ).toEqual(weapon);
    for (const width of [375, 768, 1024, 1440]) {
      await a.setViewportSize({ width, height: 900 });
      await expect
        .poll(() =>
          a.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);
      await a.screenshot({ path: testInfo.outputPath(`overlay-${width}.png`) });
    }
    const mobile = await browser.newContext({
      baseURL,
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    try {
      await mobile.addCookies(await contexts[0]!.cookies());
      const mobilePage = await mobile.newPage();
      let sockets = 0;
      mobilePage.on("websocket", (socket) => {
        if (socket.url().includes("/gameplay")) sockets++;
      });
      await mobilePage.goto(a.url());
      await expect(
        mobilePage.getByRole("heading", {
          name: "A keyboard and mouse are required",
        }),
      ).toBeVisible();
      expect(sockets).toBe(0);
      await mobilePage.screenshot({
        path: testInfo.outputPath("unsupported-mobile.png"),
      });
    } finally {
      await mobile.close();
    }
    await a.getByRole("button", { name: "Leave match", exact: true }).click();
    await expect(a.getByRole("dialog")).toBeVisible();
    await a.getByRole("button", { name: "Stay in match", exact: true }).click();
    await expect(a.getByRole("dialog")).not.toBeVisible();
    await a.getByRole("button", { name: "Leave match", exact: true }).click();
    await a
      .getByRole("dialog")
      .getByRole("button", { name: "Leave match", exact: true })
      .click();
    await expect(a).toHaveURL(/\/games\/nightfall-protocol\/rooms/);
    await expect(
      b.getByRole("heading", { name: "Cooperative session ended" }),
    ).toBeVisible();
    await expect.poll(() => activeSockets[1]?.isClosed()).toBe(true);
    await expect(b).toHaveURL(/\/games\/nightfall-protocol\/rooms/);
    expect(errors).toEqual([]);
  } finally {
    for (const context of contexts) await context.close();
  }
});
