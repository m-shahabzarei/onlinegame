import {
  cleanup,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import {
  Phase6Shop,
  shopFeedbackText,
  type Phase6ShopProps,
} from "./phase6-shop";
import { emptyPhase6Player } from "@/game/shared/phase6";
afterEach(cleanup);
function props(): Phase6ShopProps {
  const player = emptyPhase6Player();
  player.scrap = 500;
  return {
    open: true,
    loadout: player,
    seconds: 30,
    wave: 3,
    pending: false,
    feedback: null,
    onPurchase: vi.fn(),
    onEquip: vi.fn(),
    onClose: vi.fn(),
    onReturn: vi.fn(),
    restoreFocus: vi.fn(),
    locale: "en",
  };
}
it("requires an explicit primary replacement, and does not offer ineffective item purchases", async () => {
  const user = userEvent.setup(),
    p = props();
  render(<Phase6Shop {...p} />);
  const viper = screen
    .getByText("Viper SMG", { selector: "h4" })
    .closest("article")!;
  await user.click(within(viper).getByRole("button", { name: /^Buy$/ }));
  expect(p.onPurchase).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Confirm purchase" }));
  expect(p.onPurchase).toHaveBeenCalledExactlyOnceWith(
    "weapon",
    "smg-01",
    "ar-01",
  );
  expect(
    screen.getAllByText("Unavailable · no gameplay effect in this build"),
  ).toHaveLength(5);
});
it("focuses close, traps keyboard focus, closes with Escape, and restores focus", async () => {
  const user = userEvent.setup(),
    p = props();
  const rendered = render(<Phase6Shop {...p} />);
  const dialog = screen.getByRole("dialog");
  expect(
    screen.getByRole("heading", { name: "Resupply and upgrade" }),
  ).toHaveFocus();
  await user.tab();
  expect(dialog.contains(document.activeElement)).toBe(true);
  await user.keyboard("{Escape}");
  expect(p.onClose).toHaveBeenCalledOnce();
  rendered.rerender(<Phase6Shop {...p} open={false} />);
  await waitFor(() => expect(p.restoreFocus).toHaveBeenCalledOnce());
});
it("renders Persian names, costs, reasons and accessible results without English fallback", () => {
  render(
    <Phase6Shop
      {...props()}
      locale="fa"
      feedback={{ requestId: "test", code: "insufficient_scrap" }}
    />,
  );
  expect(screen.getByRole("dialog")).toHaveAccessibleName("تجهیز و ارتقا");
  expect(screen.getByText("قراضه کافی ندارید.")).toBeVisible();
  expect(screen.getByText("مسلسل وایپر", { selector: "h4" })).toBeVisible();
  expect(screen.getByRole("timer")).toHaveTextContent("۳۰ ثانیه باقی مانده");
  expect(
    shopFeedbackText("fa", {
      requestId: "a",
      code: "accepted",
      kind: "weapon",
      weaponId: "pistol-01",
    }),
  ).toContain("تپانچه PX-9");
});
