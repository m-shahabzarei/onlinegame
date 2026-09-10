import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  command: vi.fn(),
  connection: "CONNECTED",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("./client", async (original) => ({
  ...(await original<typeof import("./client")>()),
  lobbyRequest: mocks.request,
  sendLobbyCommand: mocks.command,
}));
vi.mock("./use-lobby-connection", () => ({
  useLobbyConnection: () => ({ connection: mocks.connection, retry: vi.fn() }),
}));
import { RoomBrowser } from "./room-browser";

beforeEach(() => {
  mocks.connection = "CONNECTED";
  mocks.request.mockResolvedValue({ rooms: [], currentCode: null });
});
afterEach(cleanup);

describe("room browser recovery", () => {
  it("gates creation and joining while disconnected and retains the invite input", async () => {
    const user = userEvent.setup();
    const view = render(
      <RoomBrowser slug="nightfall-protocol" name="Nightfall Protocol" />,
    );
    await screen.findByRole("heading", { name: "Your squad starts here." });
    await user.type(
      screen.getByRole("textbox", { name: "Have an invite code?" }),
      "abcd-2345",
    );
    mocks.connection = "DISCONNECTED";
    view.rerender(
      <RoomBrowser slug="nightfall-protocol" name="Nightfall Protocol" />,
    );
    expect(screen.getByRole("button", { name: "Create room" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Join with code" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("textbox", { name: "Have an invite code?" }),
    ).toHaveValue("abcd-2345");
  });
  it("retries an uncertain join with the same idempotency key", async () => {
    const user = userEvent.setup();
    mocks.command.mockRejectedValue(new Error("Network interrupted"));
    render(<RoomBrowser slug="nightfall-protocol" name="Nightfall Protocol" />);
    await user.type(
      screen.getByRole("textbox", { name: "Have an invite code?" }),
      "abcd-2345",
    );
    await user.click(screen.getByRole("button", { name: "Join with code" }));
    await screen.findByRole("alert");
    const first = mocks.command.mock.calls[0]![0];
    expect(first.code).toBe("ABCD2345");
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.command.mock.calls[1]![0]).toEqual(first);
  });
});
