import { expect, test } from "@playwright/test";
import { createTranslator } from "../src/i18n/client";

test("authenticated switching persists User.locale above a conflicting cookie", async ({
  page,
  context,
  baseURL,
}) => {
  const t = createTranslator("en");
  await page.goto("/register");
  await page
    .getByRole("button", { name: t("platform.skipOnboarding"), exact: true })
    .click();
  const identity = `locale${Date.now()}`;
  await page.getByLabel(t("auth.username"), { exact: true }).fill(identity);
  await page
    .getByLabel(t("auth.email"), { exact: true })
    .fill(`${identity}@example.invalid`);
  await page
    .getByLabel(t("auth.displayName"), { exact: true })
    .fill("Locale QA");
  await page
    .getByLabel(t("auth.password"), { exact: true })
    .fill("Local-QA-fixture-97!");
  await page
    .getByLabel(t("auth.confirmPassword"), { exact: true })
    .fill("Local-QA-fixture-97!");
  await page
    .getByRole("button", { name: t("auth.createAccount"), exact: true })
    .click();
  await expect(page).not.toHaveURL(/\/register/, { timeout: 90000 });
  await page.getByRole("button", { name: "فارسی", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  expect(
    (await context.cookies()).find(
      (cookie) => cookie.name === "twoplayer_locale",
    )?.value,
  ).toBe("fa");
  // User.locale must remain authoritative even when a stale guest cookie disagrees.
  await context.addCookies([
    { name: "twoplayer_locale", value: "en", url: baseURL! },
  ]);
  const html = await (await page.request.get("/games")).text();
  expect(html).toMatch(/<html[^>]+lang="fa"[^>]+dir="rtl"/);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("guest switching refreshes the router and persists the first Persian server render", async ({
  page,
}) => {
  await page.goto("/games");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page
    .getByRole("button", { name: "Skip onboarding", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.evaluate(() => {
    (
      window as Window & { localeNavigationMarker?: string }
    ).localeNavigationMarker = "same-document";
  });
  await page.getByRole("button", { name: "فارسی", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  expect(
    await page.evaluate(
      () =>
        (window as Window & { localeNavigationMarker?: string })
          .localeNavigationMarker,
    ),
  ).toBe("same-document");
  expect(
    (await page.context().cookies()).find(
      (cookie) => cookie.name === "twoplayer_locale",
    )?.value,
  ).toBe("fa");
  const html = await (await page.request.get("/games")).text();
  expect(html).toMatch(/<html[^>]+lang="fa"[^>]+dir="rtl"/);
  await expect(
    page.getByRole("heading", { name: "مأموریت بعدی را انتخاب کنید." }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("Persian routes use local fonts and fit phone, tablet and desktop widths", async ({
  page,
  context,
  baseURL,
}) => {
  if (!baseURL) throw new Error("TEST_BASE_URL_REQUIRED");
  await context.addCookies([
    { name: "twoplayer_locale", value: "fa", url: baseURL },
  ]);
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/games",
      "/games/nightfall-protocol",
      "/login",
      "/register",
    ]) {
      await page.goto(path);
      if (width === 375 && path === "/games") {
        await page
          .getByRole("button", { name: "رد کردن راهنمای شروع", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toBeHidden();
      }
      await expect(page.locator("html")).toHaveAttribute("lang", "fa");
      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth + 1,
        ),
        `${path} at ${width}`,
      ).toBe(true);
      const fonts = await page.locator("body").evaluate((node) => {
        const style = getComputedStyle(node);
        return {
          family: style.fontFamily.replace(/["']/g, ""),
          persian: style
            .getPropertyValue("--font-vazirmatn")
            .split(",")[0]!
            .replace(/["']/g, "")
            .trim(),
        };
      });
      expect(fonts.persian).not.toBe("");
      expect(fonts.family).toContain(fonts.persian);
      await expect(page.locator("main")).toBeVisible();
    }
  }
});
