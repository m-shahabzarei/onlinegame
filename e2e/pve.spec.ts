import { test, expect, type Page } from "@playwright/test";
import type { ServerMessage, WorldSnapshot } from "../src/game/shared/protocol";
import { writeFileSync } from "node:fs";
test("two browser clients fight, down, revive, reconnect and complete Phase 5", async ({
  browser,
  baseURL,
}, testInfo) => {
  test.skip(
    !process.env.PVE_FIXTURE_KEY,
    "Run the isolated local PvE harness for deterministic authority fixtures",
  );
  if (!baseURL) throw new Error("Test base URL required");
  // Two real 1080p clients plus cold development compilation on local hardware.
  test.setTimeout(360000);
  const contexts = await Promise.all(
    [0, 1].map(() =>
      browser.newContext({ baseURL, viewport: { width: 1920, height: 1080 } }),
    ),
  );
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const latest: (WorldSnapshot | undefined)[] = [],
    messages: ServerMessage[][] = [[], []],
    ids = ["", ""],
    errors: string[] = [];
  let matchId = "";
  pages.forEach((p, i) => {
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("websocket", (socket) => {
      if (!socket.url().includes("/gameplay")) return;
      socket.on("framereceived", (frame) => {
        const message = JSON.parse(frame.payload.toString()) as ServerMessage;
        messages[i]!.push(message);
        if (message.type === "welcome") {
          ids[i] = message.playerId;
          latest[i] = message.snapshot;
        }
        if (message.type === "worldSnapshot") latest[i] = message.snapshot;
      });
    });
  });
  const self = (slot: number) =>
    latest[slot]?.players.find((p) => p.id === ids[slot]);
  async function fixture(action: string) {
    await expect
      .poll(async () =>
        (
          await contexts[0]!.request.post("http://127.0.0.1:8092", {
            headers: { Authorization: `Bearer ${process.env.PVE_FIXTURE_KEY}` },
            data: { action, matchId },
          })
        ).status(),
      )
      .toBe(200);
  }
  async function enter(p: Page) {
    await p.bringToFront();
    await p.getByRole("button", { name: "Enter arena", exact: true }).click();
    await expect
      .poll(() => p.evaluate(() => document.pointerLockElement?.tagName))
      .toBe("CANVAS");
  }
  try {
    for (const page of pages) {
      await page.goto(
        "/continue-as-guest?next=%2Fgames%2Fnightfall-protocol%2Frooms",
      );
      await page
        .getByRole("button", { name: "Continue as guest", exact: true })
        .click();
      await expect(page).toHaveURL(/\/games\/nightfall-protocol\/rooms/);
    }
    async function lobby(slot: number, data: Record<string, unknown>) {
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
    const room = await lobby(0, {
      type: "create",
      slug: "nightfall-protocol",
      visibility: "PRIVATE",
    });
    await lobby(1, { type: "join", code: room.code });
    for (const p of pages) {
      await p.goto(`/rooms/${room.code}`);
      await p.getByRole("button", { name: "I’m Ready", exact: true }).click();
    }
    await pages[0]!
      .getByRole("button", { name: "Start Game", exact: true })
      .click();
    for (const p of pages) await expect(p).toHaveURL(/\/play\//);
    matchId = new URL(pages[0]!.url()).pathname.split("/").at(-1)!;
    expect(new URL(pages[1]!.url()).pathname).toBe(`/play/${matchId}`);
    await fixture("protect");
    for (const p of pages)
      await expect(
        p.getByRole("button", { name: "Enter arena", exact: true }),
      ).toBeVisible();
    await expect
      .poll(() =>
        latest.every(
          (s) => s?.pve.wave.number === 1 && s.pve.zombies.length > 0,
        ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        messages[0]!.some(
          (a) =>
            a.type === "worldSnapshot" &&
            a.snapshot.pve.zombies.length > 0 &&
            messages[1]!.some(
              (b) =>
                b.type === "worldSnapshot" &&
                b.snapshot.tick === a.snapshot.tick &&
                JSON.stringify(b.snapshot.pve.zombies) ===
                  JSON.stringify(a.snapshot.pve.zombies),
            ),
        ),
      )
      .toBe(true);
    const a = pages[0]!,
      b = pages[1]!;
    await fixture("combat");
    await enter(a);
    await a.mouse.down();
    await expect
      .poll(() =>
        messages[0]!.some(
          (m) => m.type === "shotConfirmed" && !!m.zombieHit?.killed,
        ),
      )
      .toBe(true);
    await a.mouse.up();
    expect(
      messages[0]!.some(
        (m) => m.type === "shotConfirmed" && m.zombieHit?.region === "head",
      ),
    ).toBe(true);
    await a.keyboard.press("Escape");
    await fixture("down");
    await expect.poll(() => self(0)?.life).toBe("DOWNED");
    await expect(
      a.getByText("DOWNED · waiting for your teammate"),
    ).toBeVisible();
    await enter(b);
    await b.keyboard.down("KeyE");
    await expect.poll(() => latest[1]?.pve.revive !== null).toBe(true);
    await b.keyboard.up("KeyE");
    await expect.poll(() => latest[1]?.pve.revive).toBeNull();
    expect(self(0)?.life).toBe("DOWNED");
    await b.keyboard.down("KeyE");
    await expect.poll(() => self(0)?.life).toBe("ALIVE");
    await b.keyboard.up("KeyE");
    expect(self(0)?.health).toBe(45);
    await b.keyboard.press("Escape");
    const weapon = { ...self(0)!.weapon },
      wave = latest[0]!.pve.wave.number;
    await a.reload();
    await expect(
      a.getByRole("button", { name: "Enter arena", exact: true }),
    ).toBeVisible();
    expect(self(0)!.weapon).toEqual(weapon);
    expect(self(0)!.health).toBe(45);
    expect(latest[0]!.pve.wave.number).toBe(wave);
    await fixture("stress");
    await expect
      .poll(() => latest[0]?.pve.zombies.filter((z) => z.health > 0).length)
      .toBe(24);
    await a.getByRole("button", { name: "Settings", exact: true }).click();
    await a
      .getByRole("checkbox", { name: "Network and performance diagnostics" })
      .check();
    await a
      .getByRole("checkbox", { name: "Reduce camera motion and weapon bob" })
      .check();
    await a.keyboard.press("Escape");
    await enter(a);
    await a.waitForTimeout(5000);
    const performanceSample = await a
      .locator("canvas")
      .evaluate(async (element) => {
        const gl = (element as HTMLCanvasElement).getContext("webgl2")!;
        const extension = gl.getExtension("WEBGL_debug_renderer_info");
        const renderer = String(
          gl.getParameter(
            extension ? extension.UNMASKED_RENDERER_WEBGL : gl.RENDERER,
          ),
        );
        const frames: number[] = [];
        const started = performance.now();
        let previous = started;
        await new Promise<void>((resolve) => {
          function frame(now: number) {
            frames.push(now - previous);
            previous = now;
            if (now - started >= 10000) resolve();
            else requestAnimationFrame(frame);
          }
          requestAnimationFrame(frame);
        });
        frames.sort((a, b) => a - b);
        return {
          renderer,
          seconds: (previous - started) / 1000,
          frames: frames.length,
          meanFrameMs: frames.reduce((sum, ms) => sum + ms, 0) / frames.length,
          p95FrameMs: frames[Math.floor(frames.length * 0.95)],
          maxFrameMs: frames.at(-1),
        };
      });
    const diagnostic = await a.getByLabel("Game diagnostics").innerText();
    const performanceRecord = JSON.stringify(
      { ...performanceSample, diagnostic },
      null,
      2,
    );
    writeFileSync(
      testInfo.outputPath("pve-browser-performance.json"),
      performanceRecord,
    );
    console.log("PVE_BROWSER_PERFORMANCE", performanceRecord);
    await testInfo.attach("24-zombie-1080p-diagnostics", {
      body: diagnostic,
      contentType: "text/plain",
    });
    console.log("PVE_BROWSER_DIAGNOSTICS", diagnostic);
    await a.screenshot({
      path: testInfo.outputPath("pve-24-zombies-1080p.png"),
    });
    await a.keyboard.press("Escape");
    await fixture("down");
    await expect.poll(() => self(0)?.life).toBe("DOWNED");
    await fixture("bleed");
    await expect.poll(() => self(0)?.life).toBe("ELIMINATED");
    await fixture("clearWave");
    await expect.poll(() => latest[0]?.pve.wave.state).toBe("INTERMISSION");
    await expect.poll(() => self(0)?.life).toBe("ALIVE");
    await expect.poll(() => latest[1]?.pve.wave.state).toBe("INTERMISSION");
    await fixture("finish");
    for (const p of pages)
      await expect(
        p.getByRole("heading", { name: "Five-wave survival complete" }),
      ).toBeVisible({ timeout: 60000 });
    expect(latest[0]?.pve.wave.number).toBe(5);
    expect(latest[0]?.pve.wave.alive).toBe(0);
    expect(
      messages[0]!.filter(
        (m) =>
          m.type === "waveStateChanged" && m.wave.state === "PHASE_COMPLETE",
      ),
    ).toHaveLength(1);
    await a.screenshot({ path: testInfo.outputPath("pve-completion.png") });
    expect(errors).toEqual([]);
  } finally {
    for (const context of contexts) await context.close();
  }
});
