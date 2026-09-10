import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ update: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/server/actions/locale", () => ({
  updateLocaleAction: mocks.update,
}));
import { LanguageSwitcher } from "./language-switcher";

beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);
it("shows a localized pending state and refreshes after persistence", async () => {
  let finish!: (value: { ok: true }) => void;
  mocks.update.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(<LanguageSwitcher locale="en" />);
  fireEvent.click(screen.getByRole("button", { name: "فارسی" }));
  expect(
    screen.getByRole("button", { name: "Saving language…" }),
  ).toBeDisabled();
  expect(mocks.refresh).not.toHaveBeenCalled();
  await act(async () => finish({ ok: true }));
  expect(mocks.update).toHaveBeenCalledWith("fa");
  expect(mocks.refresh).toHaveBeenCalledOnce();
});
it("announces a Persian persistence failure without changing the current router tree", async () => {
  mocks.update.mockResolvedValue({ ok: false, code: "locale_save_failed" });
  render(<LanguageSwitcher locale="fa" />);
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "English" })),
  );
  expect(screen.getByRole("status")).toHaveTextContent(
    "زبان ذخیره نشد. دوباره تلاش کنید.",
  );
  expect(mocks.refresh).not.toHaveBeenCalled();
});
