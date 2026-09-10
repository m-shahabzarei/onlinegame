import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LobbySnapshot } from "@/domain/lobby";
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  command: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  connection: "CONNECTED",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
}));
vi.mock("./client", async (original) => ({
  ...(await original<typeof import("./client")>()),
  lobbyRequest: mocks.request,
  sendLobbyCommand: mocks.command,
}));
vi.mock("./use-lobby-connection", () => ({
  useLobbyConnection: () => ({ connection: mocks.connection, retry: vi.fn() }),
}));
import { RoomLobby } from "./room-lobby";
import { InviteControls } from "./shared";
let room: LobbySnapshot;
beforeEach(() => {
  mocks.connection = "CONNECTED";
  room = {
    code: "ABCD2345",
    game: {
      slug: "nightfall-protocol",
      name: "Nightfall Protocol",
      description: "Preparation only",
    },
    visibility: "PRIVATE",
    status: "WAITING",
    maxPlayers: 2,
    stateVersion: 2,
    observedAt: 100,
    expiresAt: Date.now() + 7200000,
    selfId: "a",
    matchId: null,
    startBlocker: "Both players must be Ready.",
    members: [
      {
        userId: "a",
        displayName: "Alpha",
        avatarUrl: null,
        isGuest: false,
        role: "HOST",
        ready: false,
        connection: "CONNECTED",
      },
      {
        userId: "b",
        displayName: "Bravo",
        avatarUrl: null,
        isGuest: true,
        role: "PLAYER",
        ready: true,
        connection: "CONNECTED",
      },
    ],
  };
  mocks.request.mockImplementation(async (query) =>
    query.op === "room" ? structuredClone(room) : { alive: true },
  );
});
afterEach(cleanup);
describe("lobby interaction and accessibility", () => {
  it("gates Start until authoritative readiness and routes to preparation", async () => {
    const user = userEvent.setup();
    render(<RoomLobby code={room.code} />);
    expect(
      await screen.findByRole("button", { name: "Start Game" }),
    ).toBeDisabled();
    mocks.command.mockImplementation(async (command) => {
      room = {
        ...room,
        stateVersion: room.stateVersion + 1,
        members: room.members.map((m) => ({ ...m, ready: true })),
        startBlocker: null,
        ...(command.type === "start"
          ? { status: "STARTING", matchId: "reserved-session" }
          : {}),
      };
      return { room, code: room.code };
    });
    await user.click(screen.getByRole("button", { name: "I’m Ready" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Start Game" })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Start Game" }));
    await waitFor(() =>
      expect(mocks.replace).toHaveBeenCalledWith("/play/reserved-session"),
    );
  });
  it("retains Not Ready and explains failure after a rejected command", async () => {
    mocks.command.mockRejectedValueOnce(new Error("network interrupted"));
    const user = userEvent.setup();
    render(<RoomLobby code={room.code} />);
    await user.click(await screen.findByRole("button", { name: "I’m Ready" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /connection interrupted/i,
    );
    expect(screen.getByRole("button", { name: "I’m Ready" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Start Game" })).toBeDisabled();
  });
  it("provides guest labels and hides host controls from the second member", async () => {
    room.selfId = "b";
    render(<RoomLobby code={room.code} />);
    expect(await screen.findByText("Bravo (you)")).toBeVisible();
    expect(screen.getByText("Guest")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Start Game" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Close room" })).toBeNull();
  });
  it("requires a keyboard-accessible confirmation before closing", async () => {
    const user = userEvent.setup();
    render(<RoomLobby code={room.code} />);
    await user.click(await screen.findByRole("button", { name: "Close room" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Close room?");
    expect(mocks.command).not.toHaveBeenCalled();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Close room" })).toHaveFocus();
  });
  it("shows connection text and disables commands during reconnect", async () => {
    mocks.connection = "RECONNECTING";
    render(<RoomLobby code={room.code} />);
    expect(
      await screen.findByRole("button", { name: "I’m Ready" }),
    ).toBeDisabled();
    expect(screen.getByText("Reconnecting")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Retry connection" }),
    ).toBeEnabled();
  });
  it("copies a canonical invite with visible success feedback", async () => {
    const user = userEvent.setup();
    render(<InviteControls code="ABCD2345" />);
    await user.click(screen.getByRole("button", { name: "Copy invite link" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Invite link copied.",
    );
    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/rooms/ABCD2345`,
    );
  });
});
