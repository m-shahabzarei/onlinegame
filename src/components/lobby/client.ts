import {
  LobbyError,
  type LobbyErrorCode,
  type LobbyCommand,
  type CommandResult,
} from "@/domain/lobby";

export class LobbyClientError extends LobbyError {
  constructor(
    code: LobbyErrorCode,
    readonly correlationId?: string,
  ) {
    super(code);
  }
}
export async function lobbyRequest<T>(
  query: Record<string, string>,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/lobby?${new URLSearchParams(query)}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: signal ?? AbortSignal.timeout(12_000),
  });
  const payload = (await response.json()) as {
    ok: boolean;
    data: T;
    error?: { code: LobbyErrorCode; correlationId?: string };
  };
  if (!payload.ok)
    throw new LobbyClientError(
      payload.error?.code ?? "SERVICE_UNAVAILABLE",
      payload.error?.correlationId,
    );
  return payload.data;
}
export const sendLobbyCommand = (command: LobbyCommand) =>
  lobbyRequest<CommandResult>({ op: "command" }, command);
export const errorMessage = (error: unknown) =>
  error instanceof LobbyError
    ? error.message
    : "Connection interrupted. Your input is saved; try again.";
