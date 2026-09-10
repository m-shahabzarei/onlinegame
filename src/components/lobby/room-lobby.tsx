"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Crown,
  LockKeyhole,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from "lucide-react";
import {
  reconcileSnapshot,
  type LobbyCommand,
  type LobbySnapshot,
} from "@/domain/lobby";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  buttonVariants,
  Card,
  Skeleton,
} from "@/components/ui";
import {
  errorMessage,
  LobbyClientError,
  lobbyRequest,
  sendLobbyCommand,
} from "./client";
import { ConfirmAction, ConnectionBanner, InviteControls } from "./shared";
import { useLobbyConnection } from "./use-lobby-connection";

type MemberAction = "ready" | "start" | "leave" | "close" | "kick" | "cancel";
export function RoomLobby({
  code,
  prepare = false,
}: {
  code: string;
  prepare?: boolean;
}) {
  const router = useRouter();
  const [room, setRoom] = useState<LobbySnapshot | null>(null);
  const [error, setError] = useState("");
  const [accessError, setAccessError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const latest = useRef<LobbySnapshot | null>(null);
  const lastHeartbeat = useRef(0);
  const [failedCommand, setFailedCommand] = useState<LobbyCommand | null>(null);
  const mounted = useRef(true);
  const accept = useCallback((snapshot: LobbySnapshot) => {
    if (!mounted.current) return;
    const previousHost = latest.current?.members.find((m) => m.role === "HOST");
    const next = reconcileSnapshot(latest.current, snapshot);
    const host = next.members.find((m) => m.role === "HOST");
    if (previousHost && host && previousHost.userId !== host.userId)
      setFeedback(`${host.displayName} is now the host.`);
    latest.current = next;
    setRoom(next);
    setAccessError(null);
  }, []);
  const refresh = useCallback(async () => {
    try {
      if (Date.now() - lastHeartbeat.current >= 14_000) {
        await lobbyRequest({ op: "heartbeat" }, { code });
        lastHeartbeat.current = Date.now();
      }
      const snapshot = await lobbyRequest<LobbySnapshot>({ op: "room", code });
      accept(snapshot);
    } catch (error) {
      if (mounted.current) {
        if (
          error instanceof LobbyClientError &&
          [
            "ROOM_UNAVAILABLE",
            "ROOM_KICKED",
            "MEMBERSHIP_ENDED",
            "INVALID_INPUT",
            "UNAUTHENTICATED",
          ].includes(error.code)
        ) {
          setAccessError(error.code);
          latest.current = null;
          setRoom(null);
        }
        setError(errorMessage(error));
      }
      throw error;
    }
  }, [accept, code]);
  const { connection, retry } = useLobbyConnection({ code }, refresh);
  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(() => void refresh().catch(() => {}), 0);
    return () => {
      mounted.current = false;
      clearTimeout(timer);
    };
  }, [refresh]);
  useEffect(() => {
    if (
      (room?.status === "STARTING" || room?.status === "IN_MATCH") &&
      room.matchId
    )
      router.replace(`/play/${encodeURIComponent(room.matchId)}`);
    if (room?.status === "WAITING" && prepare) router.replace(`/rooms/${code}`);
  }, [room?.status, room?.matchId, prepare, router, code]);
  async function execute(command: LobbyCommand) {
    if (pending || (command.type !== "join" && connection !== "CONNECTED"))
      return;
    setPending(true);
    setError("");
    setFailedCommand(command);
    try {
      const result = await sendLobbyCommand(command);
      setFailedCommand(null);
      if (result.room) {
        accept(result.room);
        setFeedback(
          command.type === "ready"
            ? command.ready
              ? "You are Ready."
              : "You are Not Ready."
            : "Room updated.",
        );
        lastHeartbeat.current = 0;
        retry();
      } else {
        router.push(
          `/games/${latest.current?.game.slug ?? "nightfall-protocol"}/rooms`,
        );
      }
    } catch (error) {
      setError(errorMessage(error));
      if (
        error instanceof LobbyClientError &&
        error.code !== "SERVICE_UNAVAILABLE"
      )
        setFailedCommand(null);
      await refresh().catch(() => {});
    } finally {
      setPending(false);
    }
  }
  async function action(type: MemberAction, targetUserId?: string) {
    if (!room) return;
    const base = {
      code,
      requestId: crypto.randomUUID(),
      expectedVersion: room.stateVersion,
    };
    let command: LobbyCommand;
    if (type === "ready")
      command = {
        ...base,
        type,
        ready: !room.members.find((m) => m.userId === room.selfId)?.ready,
      };
    else if (type === "kick")
      command = { ...base, type, targetUserId: targetUserId! };
    else if (type === "cancel")
      command = { ...base, type, matchId: room.matchId! };
    else command = { ...base, type };
    await execute(command);
  }
  const self = room?.members.find((m) => m.userId === room.selfId);
  const host = self?.role === "HOST";
  const active = room?.status === "WAITING" || room?.status === "STARTING";
  const disabled = pending || connection !== "CONNECTED";
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          className={buttonVariants({ variant: "ghost", size: "sm" })}
          href={`/games/${room?.game.slug ?? "nightfall-protocol"}/rooms`}
        >
          Back to room browser
        </Link>
        <Badge variant="primary">Session preparation</Badge>
      </div>
      <ConnectionBanner
        state={connection}
        retry={() => {
          setError("");
          void refresh().catch(() => {});
          retry();
        }}
      />
      {error && (
        <Card padding="sm" className="space-y-3">
          <p role="alert" className="text-destructive">
            {error}
          </p>
          {failedCommand && (
            <Button
              size="sm"
              variant="outline"
              loading={pending}
              disabled={
                pending ||
                (failedCommand.type !== "join" && connection !== "CONNECTED")
              }
              onClick={() => void execute(failedCommand)}
            >
              Retry last action
            </Button>
          )}
        </Card>
      )}
      <p
        role="status"
        aria-live="polite"
        className="text-success-foreground min-h-5 text-sm"
      >
        {feedback}
      </p>
      {!room ? (
        accessError ? (
          <Card padding="lg" className="mx-auto max-w-xl space-y-5">
            <h1 className="font-display text-2xl">
              {accessError === "ROOM_KICKED"
                ? "You were removed"
                : accessError === "UNAUTHENTICATED"
                  ? "Restore your session"
                  : "Join your partner"}
            </h1>
            <p className="text-muted-foreground">
              {accessError === "ROOM_KICKED"
                ? "The host ended your membership. You can create a new room."
                : "Your invite is kept here. Joining checks availability before revealing room details."}
            </p>
            <p className="font-mono text-2xl tracking-widest" dir="ltr">
              {code}
            </p>
            {!["ROOM_KICKED", "INVALID_INPUT", "UNAUTHENTICATED"].includes(
              accessError,
            ) && (
              <Button
                loading={pending}
                loadingText="Joining room"
                onClick={() =>
                  void execute({
                    type: "join",
                    code,
                    requestId: crypto.randomUUID(),
                  })
                }
              >
                Join room
              </Button>
            )}
            {accessError === "UNAUTHENTICATED" && (
              <Link
                className={buttonVariants()}
                href={`/login?next=${encodeURIComponent(`/rooms/${code}`)}`}
              >
                Sign in again
              </Link>
            )}
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/games/nightfall-protocol/rooms"
            >
              Browse rooms
            </Link>
          </Card>
        ) : (
          <div
            aria-label="Loading lobby"
            role="status"
            className="grid gap-6 md:grid-cols-2"
          >
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
          </div>
        )
      ) : (
        <>
          <header className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant={active ? "primary" : "warning"}>
                {room.status === "STARTING"
                  ? "Starting · Session reserved"
                  : room.status === "WAITING"
                    ? "Waiting for readiness"
                    : room.status === "EXPIRED"
                      ? "Room expired"
                      : "Room closed"}
              </Badge>
              <Badge variant="outline">
                <LockKeyhole aria-hidden="true" className="size-3.5" />
                {room.visibility === "PRIVATE" ? "Private room" : "Public room"}
              </Badge>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl">
              {prepare && room.status === "STARTING"
                ? "Your room is prepared."
                : room.game.name}
            </h1>
            <p className="text-muted-foreground max-w-2xl leading-7">
              {room.game.description}
            </p>
          </header>
          {!active ? (
            <Card padding="lg" className="space-y-4">
              <h2 className="font-display text-xl">
                {room.status === "EXPIRED"
                  ? "This invite has expired."
                  : "This room has closed."}
              </h2>
              <p className="text-muted-foreground">
                Create a new room to bring your partner back together.
              </p>
              <Link
                className={buttonVariants()}
                href={`/games/${room.game.slug}/rooms`}
              >
                Find or create a room
              </Link>
            </Card>
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)]">
              <section className="space-y-4" aria-labelledby="squad-title">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="squad-title" className="font-display text-xl">
                    Your squad
                  </h2>
                  <span className="text-muted-foreground flex items-center gap-2 font-mono text-sm">
                    <UsersRound aria-hidden="true" className="size-4" />
                    {room.members.length}/{room.maxPlayers}
                  </span>
                </div>
                {Array.from({ length: room.maxPlayers }, (_, index) => {
                  const member = room.members[index];
                  return member ? (
                    <Card
                      key={member.userId}
                      padding="md"
                      className="min-h-40 space-y-4"
                    >
                      <div className="flex min-w-0 items-start gap-4">
                        <Avatar className="size-14 shrink-0">
                          <AvatarImage
                            src={member.avatarUrl ?? undefined}
                            alt={`${member.displayName} avatar`}
                          />
                          <AvatarFallback>
                            {member.displayName.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 space-y-2">
                          <h3 className="text-lg font-semibold break-words">
                            {member.displayName}
                            {member.userId === room.selfId ? " (you)" : ""}
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {member.role === "HOST" && (
                              <Badge variant="primary">
                                <Crown
                                  aria-hidden="true"
                                  className="size-3.5"
                                />
                                Host
                              </Badge>
                            )}
                            {member.isGuest && <Badge>Guest</Badge>}
                            <Badge
                              variant={member.ready ? "success" : "neutral"}
                            >
                              {member.ready && (
                                <Check
                                  aria-hidden="true"
                                  className="size-3.5"
                                />
                              )}
                              {member.ready ? "Ready" : "Not Ready"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-muted-foreground text-sm">
                          {member.connection === "CONNECTED"
                            ? "Online · In lobby"
                            : member.connection === "RECONNECTING"
                              ? "Reconnecting · Slot held during grace period"
                              : "Disconnected"}
                        </p>
                        {host && member.userId !== room.selfId && (
                          <ConfirmAction
                            label="Remove player"
                            description={`Remove ${member.displayName} from this room? Any reserved session will be cancelled.`}
                            disabled={disabled}
                            onConfirm={() => action("kick", member.userId)}
                          />
                        )}
                      </div>
                    </Card>
                  ) : (
                    <Card
                      key={`empty-${index}`}
                      padding="lg"
                      variant="subtle"
                      className="flex min-h-40 items-center gap-4 border-dashed"
                    >
                      <UserPlus
                        className="text-primary size-8 shrink-0"
                        aria-hidden="true"
                      />
                      <div>
                        <h3 className="font-semibold">
                          {room.mode === "solo"
                            ? "Solo arena"
                            : "A place for your partner"}
                        </h3>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {room.mode === "solo"
                            ? "You are ready to play alone."
                            : "Copy the invite and share it with your second player."}
                        </p>
                      </div>
                    </Card>
                  );
                })}
                {room.status === "STARTING" && (
                  <Card padding="md" className="space-y-4">
                    <ShieldCheck
                      aria-hidden="true"
                      className="text-success size-8"
                    />
                    <h2 className="font-display text-xl">
                      Session successfully reserved
                    </h2>
                    <p className="text-muted-foreground leading-7">
                      Your training session is reserved. Connecting you to the
                      shared arena.
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {host
                        ? "Cancel preparation to return everyone to the lobby."
                        : "The host can cancel preparation and return everyone to the lobby. You can also leave the room."}
                    </p>
                    {host && (
                      <ConfirmAction
                        label="Cancel preparation"
                        description="Cancel this reservation and return both players to the lobby as Not Ready?"
                        disabled={disabled}
                        onConfirm={() => action("cancel")}
                      />
                    )}
                  </Card>
                )}
              </section>
              <aside className="space-y-5">
                <Card padding="md" className="space-y-5">
                  <div>
                    <p className="text-muted-foreground text-sm">Room code</p>
                    <p
                      dir="ltr"
                      className="text-primary mt-2 font-mono text-3xl font-semibold tracking-[0.16em]"
                    >
                      {room.code}
                    </p>
                  </div>
                  <InviteControls code={room.code} />
                  <p className="text-muted-foreground text-xs">
                    Invite expires at{" "}
                    {new Date(room.expiresAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    .
                  </p>
                </Card>
                <Card padding="md" className="space-y-4">
                  {room.status === "WAITING" && (
                    <>
                      <h2 className="font-display text-lg">
                        {host ? "Prepare your session" : "Ready when you are"}
                      </h2>
                      <Button
                        className="w-full"
                        variant={host ? "outline" : "primary"}
                        disabled={disabled}
                        loading={pending}
                        aria-pressed={self?.ready ?? false}
                        onClick={() => void action("ready")}
                      >
                        {self?.ready ? "Set Not Ready" : "I’m Ready"}
                      </Button>
                      {host && (
                        <Button
                          className="w-full"
                          disabled={disabled || !!room.startBlocker}
                          aria-describedby="start-reason"
                          onClick={() => void action("start")}
                        >
                          Start Game
                        </Button>
                      )}
                      <p
                        id="start-reason"
                        className="text-muted-foreground text-sm leading-6"
                      >
                        {room.startBlocker ??
                          (host
                            ? room.mode === "solo"
                              ? "You are ready. Start your solo session."
                              : "Both players are ready. You can reserve the session."
                            : room.mode === "solo"
                              ? "Set Ready, then the host can start."
                              : "Both players are ready. Waiting for the host to start.")}
                      </p>
                    </>
                  )}
                  <div className="border-border flex flex-wrap gap-3 border-t pt-4">
                    <ConfirmAction
                      label="Leave room"
                      description={
                        host
                          ? "Leave and transfer hosting to the remaining player? Any preparation will be cancelled."
                          : "Leave this room? Any preparation will be cancelled."
                      }
                      disabled={disabled}
                      onConfirm={() => action("leave")}
                    />
                    {host && (
                      <ConfirmAction
                        label="Close room"
                        description="Close this room for everyone? This invite will no longer accept players."
                        disabled={disabled}
                        onConfirm={() => action("close")}
                      />
                    )}
                  </div>
                </Card>
              </aside>
            </div>
          )}
          <p className="text-muted-foreground text-sm">
            {room.mode === "solo"
              ? "One player. One shared training arena."
              : "Two players. One shared training arena. Ready up to enter."}
          </p>
        </>
      )}
    </div>
  );
}
