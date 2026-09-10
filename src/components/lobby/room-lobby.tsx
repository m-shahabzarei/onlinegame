"use client";
import { lobbyErrorMessage, lobbyStartBlocker } from "@/i18n/lobby-messages";
import { useLocale, useTranslations } from "@/i18n/provider";
import { formatDate } from "@/i18n/client";

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
import { catalogCopy } from "@/i18n/catalog";
import { useLobbyConnection } from "./use-lobby-connection";

type MemberAction = "ready" | "start" | "leave" | "close" | "kick" | "cancel";
export function RoomLobby({
  code,
  prepare = false,
}: {
  code: string;
  prepare?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations();

  const router = useRouter();
  const [room, setRoom] = useState<LobbySnapshot | null>(null);
  const [error, setError] = useState("");
  const [accessError, setAccessError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<
    | { code: "newHost"; name: string }
    | { code: "youReady" | "youNotReady" | "roomUpdated" }
    | null
  >(null);
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
      setFeedback({ code: "newHost", name: host.displayName });
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
        setFeedback({
          code:
            command.type === "ready"
              ? command.ready
                ? "youReady"
                : "youNotReady"
              : "roomUpdated",
        });
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
          {t("platform.backRooms")}
        </Link>
        <Badge variant="primary">{t("platform.preparation")}</Badge>
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
            {lobbyErrorMessage(locale, error)}
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
              {t("platform.retryAction")}
            </Button>
          )}
        </Card>
      )}
      <p
        role="status"
        aria-live="polite"
        className="text-success-foreground min-h-5 text-sm"
      >
        {feedback &&
          (feedback.code === "newHost"
            ? t("platform.newHost", { name: feedback.name })
            : t(`platform.${feedback.code}`))}
      </p>
      {!room ? (
        accessError ? (
          <Card padding="lg" className="mx-auto max-w-xl space-y-5">
            <h1 className="font-display text-2xl">
              {accessError === "ROOM_KICKED"
                ? t("platform.removedTitle")
                : accessError === "UNAUTHENTICATED"
                  ? t("platform.restoreSessionTitle")
                  : t("platform.joinPartner")}
            </h1>
            <p className="text-muted-foreground">
              {accessError === "ROOM_KICKED"
                ? t("platform.removedHelp")
                : t("platform.inviteKept")}
            </p>
            <p className="font-mono text-2xl tracking-widest" dir="ltr">
              {code}
            </p>
            {!["ROOM_KICKED", "INVALID_INPUT", "UNAUTHENTICATED"].includes(
              accessError,
            ) && (
              <Button
                loading={pending}
                loadingText={t("platform.joiningRoom")}
                onClick={() =>
                  void execute({
                    type: "join",
                    code,
                    requestId: crypto.randomUUID(),
                  })
                }
              >
                {t("platform.joinRoom")}
              </Button>
            )}
            {accessError === "UNAUTHENTICATED" && (
              <Link
                className={buttonVariants()}
                href={`/login?next=${encodeURIComponent(`/rooms/${code}`)}`}
              >
                {t("platform.signInAgain")}
              </Link>
            )}
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/games/nightfall-protocol/rooms"
            >
              {t("platform.browseRooms")}
            </Link>
          </Card>
        ) : (
          <div
            aria-label={t("platform.loadingLobby")}
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
                  ? t("platform.startingReserved")
                  : room.status === "WAITING"
                    ? t("platform.waitingReadiness")
                    : room.status === "EXPIRED"
                      ? t("platform.roomExpired")
                      : t("platform.roomClosed")}
              </Badge>
              <Badge variant="outline">
                <LockKeyhole aria-hidden="true" className="size-3.5" />
                {room.visibility === "PRIVATE"
                  ? t("platform.privateRoom")
                  : t("platform.publicRoom")}
              </Badge>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl">
              {prepare && room.status === "STARTING"
                ? t("platform.roomPrepared")
                : catalogCopy(locale, room.game.slug).name}
            </h1>
            <p className="text-muted-foreground max-w-2xl leading-7">
              {catalogCopy(locale, room.game.slug).description}
            </p>
          </header>
          {!active ? (
            <Card padding="lg" className="space-y-4">
              <h2 className="font-display text-xl">
                {room.status === "EXPIRED"
                  ? t("platform.inviteExpired")
                  : t("platform.roomHasClosed")}
              </h2>
              <p className="text-muted-foreground">
                {t("platform.newRoomHelp")}
              </p>
              <Link
                className={buttonVariants()}
                href={`/games/${room.game.slug}/rooms`}
              >
                {t("platform.findRoom")}
              </Link>
            </Card>
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)]">
              <section className="space-y-4" aria-labelledby="squad-title">
                <div className="flex items-center justify-between gap-3">
                  <h2 id="squad-title" className="font-display text-xl">
                    {t("platform.squad")}
                  </h2>
                  <span className="text-muted-foreground flex items-center gap-2 font-mono text-sm">
                    <UsersRound aria-hidden="true" className="size-4" />
                    {t("platform.capacity", {
                      count: room.members.length,
                      maximum: room.maxPlayers,
                    })}
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
                            alt={t("platform.avatar", {
                              name: member.displayName,
                            })}
                          />
                          <AvatarFallback>
                            {member.displayName.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1 space-y-2">
                          <h3 className="text-lg font-semibold break-words">
                            {member.displayName}
                            {member.userId === room.selfId
                              ? t("platform.youSuffix")
                              : ""}
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {member.role === "HOST" && (
                              <Badge variant="primary">
                                <Crown
                                  aria-hidden="true"
                                  className="size-3.5"
                                />
                                {t("platform.host")}
                              </Badge>
                            )}
                            {member.isGuest && (
                              <Badge>{t("platform.guest")}</Badge>
                            )}
                            <Badge
                              variant={member.ready ? "success" : "neutral"}
                            >
                              {member.ready && (
                                <Check
                                  aria-hidden="true"
                                  className="size-3.5"
                                />
                              )}
                              {member.ready
                                ? t("platform.ready")
                                : t("platform.notReady")}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-muted-foreground text-sm">
                          {member.connection === "CONNECTED"
                            ? t("platform.onlineLobby")
                            : member.connection === "RECONNECTING"
                              ? t("platform.reconnectSlot")
                              : t("platform.disconnected")}
                        </p>
                        {host && member.userId !== room.selfId && (
                          <ConfirmAction
                            label={t("platform.removePlayer")}
                            description={t("platform.removePlayerConfirm", {
                              name: member.displayName,
                            })}
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
                            ? t("platform.soloArena")
                            : t("platform.partnerPlace")}
                        </h3>
                        <p className="text-muted-foreground mt-1 text-sm">
                          {room.mode === "solo"
                            ? t("platform.soloReady")
                            : t("platform.sharePartner")}
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
                      {t("platform.sessionReserved")}
                    </h2>
                    <p className="text-muted-foreground leading-7">
                      {t("platform.connectingArena")}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {host
                        ? t("platform.hostCancelHelp")
                        : t("platform.memberCancelHelp")}
                    </p>
                    {host && (
                      <ConfirmAction
                        label={t("platform.cancelPreparation")}
                        description={t("platform.cancelPreparationConfirm")}
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
                    <p className="text-muted-foreground text-sm">
                      {t("platform.roomCode")}
                    </p>
                    <p
                      dir="ltr"
                      className="text-primary mt-2 font-mono text-3xl font-semibold tracking-[0.16em]"
                    >
                      {room.code}
                    </p>
                  </div>
                  <InviteControls code={room.code} />
                  <p className="text-muted-foreground text-xs">
                    {t("platform.inviteExpires", {
                      time: formatDate(locale, room.expiresAt, {
                        hour: "2-digit",
                        minute: "2-digit",
                      }),
                    })}
                  </p>
                </Card>
                <Card padding="md" className="space-y-4">
                  {room.status === "WAITING" && (
                    <>
                      <h2 className="font-display text-lg">
                        {host
                          ? t("platform.prepareSession")
                          : t("platform.readyWhenYouAre")}
                      </h2>
                      <Button
                        className="w-full"
                        variant={host ? "outline" : "primary"}
                        disabled={disabled}
                        loading={pending}
                        aria-pressed={self?.ready ?? false}
                        onClick={() => void action("ready")}
                      >
                        {self?.ready
                          ? t("platform.setNotReady")
                          : t("platform.imReady")}
                      </Button>
                      {host && (
                        <Button
                          className="w-full"
                          disabled={disabled || !!room.startBlocker}
                          aria-describedby="start-reason"
                          onClick={() => void action("start")}
                        >
                          {t("platform.startGame")}
                        </Button>
                      )}
                      <p
                        id="start-reason"
                        className="text-muted-foreground text-sm leading-6"
                      >
                        {lobbyStartBlocker(locale, room) ??
                          (host
                            ? room.mode === "solo"
                              ? t("platform.soloStartHelp")
                              : t("platform.coopStartHelp")
                            : room.mode === "solo"
                              ? t("platform.setReadyHelp")
                              : t("platform.waitHostHelp"))}
                      </p>
                    </>
                  )}
                  <div className="border-border flex flex-wrap gap-3 border-t pt-4">
                    <ConfirmAction
                      label={t("platform.leaveRoom")}
                      description={
                        host
                          ? t("platform.hostLeaveConfirm")
                          : t("platform.leaveConfirm")
                      }
                      disabled={disabled}
                      onConfirm={() => action("leave")}
                    />
                    {host && (
                      <ConfirmAction
                        label={t("platform.closeRoom")}
                        description={t("platform.closeRoomConfirm")}
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
              ? t("platform.soloFooter")
              : t("platform.coopFooter")}
          </p>
        </>
      )}
    </div>
  );
}
