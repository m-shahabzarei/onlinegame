import { test, expect } from "@playwright/test";
import type { WorldSnapshot, ServerMessage } from "../src/game/shared/protocol";
import { createTranslator } from "../src/i18n/client";

for (const [mode, locale] of [
  ["solo", "en"],
  ["coop", "fa"],
] as const) {
  test(`${mode} ${locale}: earn Scrap, shop, equip, fire, reload and reconnect`, async ({
    browser,
    baseURL,
  }, info) => {
    test.skip(
      !process.env.PVE_FIXTURE_KEY || process.env.PVE_SHOP_TEST !== "1",
      "Requires isolated shop harness",
    );
    test.setTimeout(360000);
    const t = createTranslator(locale);
    const contexts = await Promise.all(
      Array.from({ length: mode === "solo" ? 1 : 2 }, () =>
        browser.newContext({
          baseURL: baseURL!,
          viewport: { width: 1440, height: 900 },
        }),
      ),
    );
    const pages = await Promise.all(contexts.map((c) => c.newPage()));
    const snapshots: (WorldSnapshot | undefined)[] = [],
      ids: string[] = [],
      messages: ServerMessage[] = [],
      errors: string[] = [];
    for (const [index, page] of pages.entries()) {
      page.setDefaultTimeout(45000);
      page.setDefaultNavigationTimeout(120000);
      await page.addInitScript(() => {
        const observed: number[] = [];
        (
          window as Window & { weaponAudioFrequencies?: number[] }
        ).weaponAudioFrequencies = observed;
        const original = AudioParam.prototype.setValueAtTime;
        AudioParam.prototype.setValueAtTime = function (value, startTime) {
          observed.push(value);
          return original.call(this, value, startTime);
        };
        const canvasLabels: string[] = [];
        (
          window as Window & { observedCanvasLabels?: string[] }
        ).observedCanvasLabels = canvasLabels;
        const draw = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function (
          text,
          x,
          y,
          maxWidth,
        ) {
          if (!canvasLabels.includes(text)) canvasLabels.push(text);
          if (maxWidth === undefined) return draw.call(this, text, x, y);
          return draw.call(this, text, x, y, maxWidth);
        };
      });
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("websocket", (socket) => {
        if (!socket.url().includes("/gameplay")) return;
        socket.on("framereceived", (frame) => {
          const message = JSON.parse(frame.payload.toString()) as ServerMessage;
          if (index === 0) messages.push(message);
          if (message.type === "welcome") {
            ids[index] = message.playerId;
            snapshots[index] = message.snapshot;
          }
          if (message.type === "worldSnapshot")
            snapshots[index] = message.snapshot;
          if (
            (message.type === "phase6State" || message.type === "shopResult") &&
            snapshots[index]
          )
            snapshots[index]!.phase6 = message.snapshot;
        });
      });
      await contexts[index]!.addCookies([
        { name: "twoplayer_locale", value: locale, url: baseURL! },
      ]);
    }
    const page = pages[0]!;
    const loadout = () => snapshots[0]?.phase6?.players[ids[0]!];
    const wave = () => snapshots[0]?.pve.wave;
    let matchId = "";
    async function fixture(action: string) {
      const response = await contexts[0]!.request.post(
        "http://127.0.0.1:8092",
        {
          headers: { Authorization: `Bearer ${process.env.PVE_FIXTURE_KEY}` },
          data: { matchId, action },
        },
      );
      expect(response.ok()).toBe(true);
    }
    async function command(index: number, data: Record<string, unknown>) {
      const response = await contexts[index]!.request.post(
        "/api/lobby?op=command",
        {
          headers: { Origin: baseURL! },
          data: { requestId: crypto.randomUUID(), ...data },
        },
      );
      expect(response.ok()).toBe(true);
      return (await response.json()).data;
    }
    async function enter() {
      await page.bringToFront();
      if (!(await page.evaluate(() => !!document.pointerLockElement))) {
        await page
          .getByRole("button", { name: t("arena.enter"), exact: true })
          .click();
        await expect
          .poll(() => page.evaluate(() => document.pointerLockElement?.tagName))
          .toBe("CANVAS");
      }
    }
    try {
      for (const p of pages) {
        await p.goto(
          "/continue-as-guest?next=%2Fgames%2Fnightfall-protocol%2Frooms",
        );
        await p
          .getByRole("button", {
            name: t("platform.skipOnboarding"),
            exact: true,
          })
          .click();
        await expect(p.getByRole("dialog")).toBeHidden();
        await p
          .getByRole("button", { name: t("auth.continueGuest"), exact: true })
          .click();
        await expect(p).toHaveURL(/\/games\/nightfall-protocol\/rooms/, {
          timeout: 90000,
        });
      }
      const room = await command(0, {
        type: "create",
        slug: "nightfall-protocol",
        visibility: "PRIVATE",
        mode,
      });
      if (mode === "coop") await command(1, { type: "join", code: room.code });
      for (const p of pages) {
        await p.goto(`/rooms/${room.code}`);
        const onboarding = p.getByRole("button", {
          name: t("platform.skipOnboarding"),
          exact: true,
        });
        if (await onboarding.isVisible()) await onboarding.click();
      }
      for (const p of pages)
        await p
          .getByRole("button", { name: t("platform.imReady"), exact: true })
          .click();
      await pages[0]!
        .getByRole("button", { name: t("platform.startGame"), exact: true })
        .click();
      for (const p of pages)
        await expect(p).toHaveURL(/\/play\//, { timeout: 90000 });
      matchId = new URL(page.url()).pathname.split("/").at(-1)!;
      // Initial asset/font preparation shares the server's 90-second startup
      // budget; subsequent gameplay assertions retain the normal short timeout.
      await expect
        .poll(() => snapshots[0]?.state, { timeout: 90000 })
        .toBe("PLAYING");
      await fixture("protect");
      await enter();
      await page.screenshot({
        path: info.outputPath(`${mode}-${locale}-rifle.png`),
      });
      // Fixture only arranges server entities/protection. Actual client fire earns every kill/reward.
      for (
        let round = 0;
        round < 12 && wave()?.state !== "INTERMISSION";
        round++
      ) {
        await expect
          .poll(
            () =>
              snapshots[0]?.pve.zombies.some((z) => z.health > 0) ||
              wave()?.state === "INTERMISSION",
          )
          .toBe(true);
        if (wave()?.state === "INTERMISSION") break;
        await fixture("stageWave");
        const kills = wave()?.defeated ?? 0;
        await page.mouse.down();
        await expect
          .poll(
            () =>
              (wave()?.defeated ?? 0) > kills ||
              wave()?.state === "INTERMISSION",
          )
          .toBe(true);
        await page.mouse.up();
      }
      await expect.poll(() => wave()?.state).toBe("INTERMISSION");
      const initialShopDuration =
        snapshots[0]!.phase6!.shopUntil - snapshots[0]!.time;
      expect(initialShopDuration).toBeGreaterThan(20000);
      expect(initialShopDuration).toBeLessThanOrEqual(30000);
      const dialog = page.getByRole("dialog", { name: t("gameShop.title") });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("heading", { name: t("gameShop.title"), exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      expect(
        await dialog.evaluate((node) => node.contains(document.activeElement)),
      ).toBe(true);
      expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
      expect(loadout()!.scrap).toBeGreaterThanOrEqual(120);
      const before = loadout()!.scrap;
      await dialog
        .locator('[data-weapon="pistol-01"]')
        .getByRole("button", { name: t("gameShop.buy"), exact: true })
        .click();
      await expect.poll(() => loadout()?.equippedWeapon).toBe("pistol-01");
      expect(loadout()!.scrap).toBe(before - 120);
      expect(loadout()!.slots).toEqual({
        primary: "ar-01",
        secondary: "pistol-01",
      });
      await expect(dialog.getByRole("status")).toContainText(
        t("gameShop.success", { weapon: t("weaponNames.pistol-01") }),
      );
      await page.screenshot({
        path: info.outputPath(`${mode}-${locale}-shop.png`),
      });
      if (locale === "fa") {
        for (const width of [375, 768, 1024, 1440]) {
          await fixture("layoutShop");
          await page.setViewportSize({ width, height: 900 });
          expect(
            await dialog.evaluate(
              (node) => node.scrollWidth <= node.clientWidth + 1,
            ),
            `Shop overflow at ${width}`,
          ).toBe(true);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
            `HUD overflow at ${width}`,
          ).toBe(true);
          expect(
            await dialog.getByRole("button").evaluateAll((buttons) =>
              buttons.every((button) => {
                const rect = button.getBoundingClientRect();
                return rect.width >= 44 && rect.height >= 44;
              }),
            ),
          ).toBe(true);
          await page.screenshot({
            path: info.outputPath(`fa-shop-${width}.png`),
          });
        }
      }
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(
        page.getByRole("dialog", { name: t("arena.leaveTitle") }),
      ).toHaveCount(0);
      await page.keyboard.press("KeyB");
      await expect(dialog).toBeVisible();
      await dialog
        .getByRole("button", { name: t("gameShop.return"), exact: true })
        .click();
      await expect
        .poll(() => page.evaluate(() => document.pointerLockElement?.tagName))
        .toBe("CANVAS");
      await expect(page.getByTestId("weapon-hud")).toHaveAttribute(
        "data-weapon",
        "pistol-01",
      );
      await page.screenshot({
        path: info.outputPath(`${mode}-${locale}-pistol.png`),
      });
      await page.keyboard.press("Digit1");
      await expect.poll(() => loadout()?.equippedWeapon).toBe("ar-01");
      await page.waitForTimeout(300); // Respect the authoritative draw cooldown.
      await page.keyboard.press("Digit2");
      await expect.poll(() => loadout()?.equippedWeapon).toBe("pistol-01");
      await fixture("expireShop");
      await expect.poll(() => snapshots[0]?.phase6?.shopOpen).toBe(false);
      await page.keyboard.press("KeyB");
      await expect(dialog).toBeHidden();
      await expect
        .poll(() => snapshots[0]?.pve.zombies.some((z) => z.health > 0))
        .toBe(true);
      await fixture("stageWave");
      await page.waitForTimeout(500); // Let the arranged positions enter the rewind history.
      const healthBefore = new Map(
        snapshots[0]!.pve.zombies.map((zombie) => [zombie.id, zombie.health]),
      );
      const confirmed = () =>
        messages.filter(
          (m) =>
            m.type === "shotConfirmed" &&
            m.playerId === ids[0] &&
            m.weaponId === "pistol-01",
        );
      const combatStart = messages.length;
      await page.mouse.down();
      await expect.poll(() => confirmed().length).toBe(1);
      await page.waitForTimeout(650); // Holding a semi-automatic trigger must not repeat.
      expect(confirmed()).toHaveLength(1);
      await page.mouse.up();
      const damage = messages
        .slice(combatStart)
        .find(
          (message) =>
            message.type === "pveEvent" &&
            message.event.kind === "zombieDamaged" &&
            message.event.playerId === ids[0],
        );
      expect(damage).toBeDefined();
      const shot = confirmed()[0];
      expect(shot?.type === "shotConfirmed" && shot.zombieHit).toBeTruthy();
      if (
        damage?.type === "pveEvent" &&
        shot?.type === "shotConfirmed" &&
        shot.zombieHit
      ) {
        expect(damage.event.amount).toBe(
          Math.min(
            healthBefore.get(shot.zombieHit.id)!,
            shot.zombieHit.region === "head" ? 71 : 32,
          ),
        );
      }
      await expect.poll(() => loadout()?.ammo["pistol-01"]?.magazine).toBe(11);
      await page.keyboard.press("KeyR");
      await expect
        .poll(() => (loadout()?.ammo["pistol-01"]?.reloadAt ?? 0) > 0)
        .toBe(true);
      await expect.poll(() => loadout()?.ammo["pistol-01"]?.magazine).toBe(12);
      expect(loadout()?.ammo["pistol-01"]?.reserve).toBe(71);
      const frequencies = await page.evaluate(
        () =>
          (window as Window & { weaponAudioFrequencies?: number[] })
            .weaponAudioFrequencies,
      );
      expect(frequencies).toEqual(expect.arrayContaining([160, 420, 580]));
      const saved = structuredClone(loadout()!);
      await fixture("disconnect");
      await expect
        .poll(() => messages.filter((m) => m.type === "welcome").length)
        .toBe(2);
      expect(loadout()!.ownedWeapons).toEqual(saved.ownedWeapons);
      expect(loadout()!.slots).toEqual(saved.slots);
      expect(loadout()!.upgrades).toEqual(saved.upgrades);
      expect(loadout()!.ammo).toEqual(saved.ammo);
      expect(loadout()!.equippedWeapon).toBe("pistol-01");
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      const labels = await page.evaluate(
        () =>
          (window as Window & { observedCanvasLabels?: string[] })
            .observedCanvasLabels,
      );
      expect(labels).toEqual(
        expect.arrayContaining([
          t("zombieNames.walker"),
          t("zombieNames.runner"),
        ]),
      );
      if (locale === "fa")
        expect(labels).not.toEqual(
          expect.arrayContaining(["WALKER", "RUNNER"]),
        );
      expect(errors).toEqual([]);
    } finally {
      for (const context of contexts) await context.close();
    }
  });
}
