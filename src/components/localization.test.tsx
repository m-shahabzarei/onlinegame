import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/provider";
import { actionMessage } from "@/i18n/action-messages";
import { getDevelopmentGame } from "@/server/catalog/catalog-data";
import { HomePage } from "./home/home-page";
import { AuthForm, GuestForm } from "./forms/auth-form";
import { ConnectionBanner, InviteControls } from "./lobby/shared";
import { GameCard } from "./catalog/game-card";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
afterEach(cleanup);

describe("Persian platform presentation", () => {
  it("renders home and all game metadata from the same Persian catalog", () => {
    const game = getDevelopmentGame("nightfall-protocol")!;
    const { container } = render(
      <LocaleProvider locale="fa">
        <HomePage featuredGames={[game]} user={null} />
      </LocaleProvider>,
    );
    expect(screen.getByRole("link", { name: "کاوش بازی‌ها" })).toBeVisible();
    expect(
      screen.getByRole("link", { name: "مشاهده جزئیات بازی پروتکل شب‌هنگام" }),
    ).toHaveAttribute("href", "/games/nightfall-protocol");
    expect(container).not.toHaveTextContent(
      /Cooperative|Explore games|Tactical|View game|Available/,
    );
    expect(screen.getByText("۳۰ دقیقه")).toBeVisible();
    expect(screen.getByText("۲ بازیکن")).toBeVisible();
  });

  it("translates semantic action failures and preserves valid form input", async () => {
    const action = vi.fn(async () => ({
      ok: false,
      error: {
        code: "INVALID_INPUT",
        message: "invalidInput",
        fieldErrors: { username: ["usernameTaken"] },
      },
    }));
    render(
      <LocaleProvider locale="fa">
        <AuthForm mode="register" action={action} />
      </LocaleProvider>,
    );
    fireEvent.change(screen.getByLabelText("نام کاربری"), {
      target: { value: "night_runner" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "ساخت حساب" }).closest("form")!,
    );
    expect(
      await screen.findByText("این نام کاربری قبلاً استفاده شده است."),
    ).toBeVisible();
    expect(screen.getByLabelText("نام کاربری")).toHaveValue("night_runner");
    expect(screen.getByText("فیلدهای مشخص‌شده را بررسی کنید.")).toBeVisible();
    expect(
      actionMessage(
        "fa",
        "unexpected private service error",
        "AUTH_UNAVAILABLE",
      ),
    ).toBe("سرویس حساب موقتاً در دسترس نیست. کمی بعد دوباره تلاش کنید.");
  });

  it("localizes guest onboarding, connection recovery, and invitation labels", () => {
    const { container } = render(
      <LocaleProvider locale="fa">
        <GuestForm action={async () => ({ ok: false })} />
        <ConnectionBanner state="DISCONNECTED" retry={() => {}} />
        <InviteControls code="ABCD2345" />
      </LocaleProvider>,
    );
    expect(
      screen.getByRole("heading", { name: "کاوش به‌عنوان مهمان" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "اتصال دوباره" })).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "دعوت قابل اشتراک" }),
    ).toHaveAttribute("dir", "ltr");
    expect(container).not.toHaveTextContent(
      /Disconnected|Copy code|Guest mode|Phase 4/,
    );
  });

  it("switches existing component copy without retaining the previous locale", () => {
    const game = getDevelopmentGame("nightfall-protocol")!;
    const view = render(
      <LocaleProvider locale="en">
        <GameCard game={game} />
      </LocaleProvider>,
    );
    expect(
      screen.getByRole("link", {
        name: "View Nightfall Protocol game details",
      }),
    ).toBeVisible();
    view.rerender(
      <LocaleProvider locale="fa">
        <GameCard game={game} />
      </LocaleProvider>,
    );
    expect(
      screen.getByRole("link", { name: "مشاهده جزئیات بازی پروتکل شب‌هنگام" }),
    ).toBeVisible();
    expect(screen.queryByText("View game brief")).not.toBeInTheDocument();
  });
});
