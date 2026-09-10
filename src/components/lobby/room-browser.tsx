"use client";
import { lobbyErrorMessage } from "@/i18n/lobby-messages";
import { useLocale } from "@/i18n/provider";
import { createTranslator, formatDate } from "@/i18n/client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  DoorOpen,
  LockKeyhole,
  Plus,
  UsersRound,
} from "lucide-react";
import {
  inviteCodeSchema,
  type LobbyCommand,
  type PublicRoom,
} from "@/domain/lobby";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  buttonVariants,
  Card,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Skeleton,
} from "@/components/ui";
import { errorMessage, lobbyRequest, sendLobbyCommand } from "./client";
import { ConnectionBanner } from "./shared";
import { useLobbyConnection } from "./use-lobby-connection";
import { clientTranslate } from "@/i18n/client";
import { catalogCopy } from "@/i18n/catalog";
import type { Locale } from "@/i18n/messages";

export function RoomBrowser({
  slug,
  name: sourceName,
  locale: explicitLocale,
}: {
  slug: string;
  name: string;
  locale?: Locale;
}) {
  const contextLocale = useLocale();
  const locale = explicitLocale ?? contextLocale;
  const t = createTranslator(locale);
  const name = catalogCopy(locale, slug).name;
  void sourceName;

  const router = useRouter();
  const query = useSearchParams();
  const [rooms, setRooms] = useState<PublicRoom[] | null>(null);
  const [currentCode, setCurrentCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [mode, setMode] = useState<"solo" | "coop">("coop");
  const retryCommand = useRef<LobbyCommand | null>(null);
  const onlyOpen = query.get("open") === "1";
  const refresh = useCallback(async () => {
    try {
      const data = await lobbyRequest<{
        rooms: PublicRoom[];
        currentCode: string | null;
      }>({ op: "list", slug });
      setRooms(data.rooms);
      setCurrentCode(data.currentCode);
      setError("");
    } catch (error) {
      setError(errorMessage(error));
      throw error;
    }
  }, [slug]);
  useEffect(() => {
    const timer = setTimeout(() => void refresh().catch(() => {}), 0);
    return () => clearTimeout(timer);
  }, [refresh]);
  const { connection, retry } = useLobbyConnection({ slug }, refresh);
  const disabled = pending || connection !== "CONNECTED";
  async function run(command: LobbyCommand) {
    if (disabled) return;
    setPending(true);
    setError("");
    retryCommand.current = command;
    try {
      const result = await sendLobbyCommand(command);
      router.push(`/rooms/${result.code}`);
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setPending(false);
    }
  }
  function join(value: string) {
    const parsed = inviteCodeSchema.safeParse(value);
    if (!parsed.success) {
      setCodeError(true);
      return;
    }
    setCodeError(false);
    void run({
      type: "join",
      code: parsed.data,
      requestId: crypto.randomUUID(),
    });
  }
  const shown = (rooms ?? []).filter(
    (r) => !onlyOpen || r.occupancy < r.maxPlayers,
  );
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:py-12">
      <Link
        href={`/games/${slug}`}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        <ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
        {t("common.backToGame")}
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="space-y-3">
          <p className="text-primary font-mono text-xs tracking-widest uppercase">
            {t("platform.preparation")}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl">
            {t("platform.chooseModeTitle")}
          </h1>
          <p className="text-muted-foreground">
            {name} · {t("common.publicRoom")} · {t("platform.roomModes")}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={disabled}>
              <Plus aria-hidden="true" className="size-4" />
              {t("common.createRoom")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("common.createRoom")}</DialogTitle>
              <DialogDescription>
                {name}
                {t("platform.invitePartner")}
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                void run({
                  type: "create",
                  slug,
                  visibility,
                  mode,
                  requestId: crypto.randomUUID(),
                });
              }}
            >
              <fieldset className="space-y-3">
                <legend className="mb-2 font-semibold">
                  {t("platform.howPlay")}
                </legend>
                {(["solo", "coop"] as const).map((value) => (
                  <label
                    key={value}
                    className="border-border hover:bg-surface-hover flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-4"
                  >
                    <input
                      type="radio"
                      name="mode"
                      value={value}
                      checked={mode === value}
                      onChange={() => setMode(value)}
                      className="accent-primary mt-1 size-5"
                    />
                    <span>
                      <span className="block font-semibold">
                        {clientTranslate(
                          locale,
                          value === "solo" ? "game.playSolo" : "game.playCoop",
                        )}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {value === "solo"
                          ? clientTranslate(locale, "game.soloDescription")
                          : clientTranslate(locale, "game.coopDescription")}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <fieldset className="space-y-3">
                <legend className="mb-2 font-semibold">
                  {t("platform.whoJoin")}
                </legend>
                {(["PUBLIC", "PRIVATE"] as const).map((value) => (
                  <label
                    key={value}
                    className="border-border hover:bg-surface-hover flex min-h-14 cursor-pointer items-start gap-3 rounded-lg border p-4"
                  >
                    <input
                      className="accent-primary mt-1 size-5 focus-visible:outline-2 focus-visible:outline-offset-4"
                      type="radio"
                      name="visibility"
                      value={value}
                      checked={visibility === value}
                      onChange={() => setVisibility(value)}
                    />
                    <span>
                      <span className="block font-semibold">
                        {value === "PUBLIC"
                          ? t("common.publicRoom")
                          : t("common.privateRoom")}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {value === "PUBLIC"
                          ? t("platform.publicRoomHelp")
                          : t("platform.privateRoomHelp")}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
              {error && (
                <p role="alert" className="text-destructive text-sm">
                  {lobbyErrorMessage(locale, error)}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <Button
                  type="submit"
                  disabled={disabled}
                  loading={pending}
                  loadingText={t("common.creating")}
                >
                  {t("platform.createRoom")}
                </Button>
                <DialogClose asChild>
                  <Button variant="outline" disabled={pending}>
                    {t("common.cancel")}
                  </Button>
                </DialogClose>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </header>
      <ConnectionBanner state={connection} retry={retry} />
      {currentCode && (
        <Card
          padding="sm"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <p>{t("platform.roomInProgress")}</p>
          <Link
            className={buttonVariants({ variant: "outline", size: "sm" })}
            href={`/rooms/${currentCode}`}
          >
            {t("platform.returnLobby")}
          </Link>
        </Card>
      )}
      <Card padding="md">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            join(code);
          }}
          className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          <Input
            label={t("common.inviteCode")}
            placeholder="ABCD 2345"
            dir="ltr"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={32}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            error={codeError ? t("platform.invalidInvite") : undefined}
            description={t("platform.codeHint")}
            className="font-mono"
          />
          <Button
            type="submit"
            disabled={disabled}
            variant="outline"
            className="sm:mt-7"
            loading={pending}
            loadingText={t("common.joining")}
          >
            <DoorOpen aria-hidden="true" className="size-4" />
            {t("common.joinWithCode")}
          </Button>
        </form>
      </Card>
      {error && !open && (
        <Card padding="sm" className="space-y-3">
          <p role="alert" className="text-destructive">
            {lobbyErrorMessage(locale, error)}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              loading={pending}
              onClick={() => {
                if (retryCommand.current && connection === "CONNECTED")
                  void run(retryCommand.current);
                else retry();
              }}
            >
              {t("common.retry")}
            </Button>
            <Link
              className={buttonVariants({ variant: "ghost", size: "sm" })}
              href={`/login?next=${encodeURIComponent(`/games/${slug}/rooms`)}`}
            >
              {t("platform.restoreSession")}
            </Link>
          </div>
        </Card>
      )}
      <section className="space-y-5" aria-labelledby="public-rooms-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="public-rooms-title" className="font-display text-xl">
            {t("common.publicRoom")}
          </h2>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={onlyOpen}
              onChange={(event) => {
                const next = new URLSearchParams(query.toString());
                if (event.target.checked) next.set("open", "1");
                else next.delete("open");
                router.replace(`?${next}`, { scroll: false });
              }}
              className="accent-primary size-5"
            />
            {t("common.onlyOpen")}
          </label>
        </div>
        {!rooms && !error ? (
          <div
            aria-label={clientTranslate(locale, "loading.rooms")}
            role="status"
            className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
          >
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-56 rounded-lg" />
            ))}
          </div>
        ) : shown.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {shown.map((room) => (
              <Card
                key={room.code}
                padding="md"
                className="flex min-h-60 flex-col gap-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <Badge>
                    {room.mode === "solo"
                      ? t("platform.soloRoom")
                      : room.occupancy === room.maxPlayers
                        ? t("platform.fullRoom")
                        : t("platform.waitingPartner")}
                  </Badge>
                  <span className="text-muted-foreground flex items-center gap-2 text-sm">
                    <UsersRound aria-hidden="true" className="size-4" />
                    {t("platform.capacity", {
                      count: room.occupancy,
                      maximum: room.maxPlayers,
                    })}
                  </span>
                </div>
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar>
                    <AvatarImage
                      src={room.host.avatarUrl ?? undefined}
                      alt={t("platform.avatar", {
                        name: room.host.displayName,
                      })}
                    />
                    <AvatarFallback>
                      {room.host.displayName.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold break-words">
                      {t("platform.hostRoom", { name: room.host.displayName })}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {t("platform.host")}
                      {room.host.isGuest ? t("platform.guestSuffix") : ""}
                    </p>
                  </div>
                </div>
                <p className="text-muted-foreground text-sm">
                  {t("platform.roomCreated", {
                    count: room.readyCount,
                    time: formatDate(locale, room.createdAt, {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  })}
                </p>
                <Button
                  variant="outline"
                  className="mt-auto w-full"
                  disabled={room.occupancy >= room.maxPlayers || disabled}
                  onClick={() => join(room.code)}
                >
                  {t("common.joinRoom")}
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          rooms && (
            <Card padding="lg" className="space-y-4 text-center">
              <UsersRound
                aria-hidden="true"
                className="text-primary mx-auto size-8"
              />
              <h3 className="font-display text-xl">
                {t("platform.roomEmptyTitle")}
              </h3>
              <p className="text-muted-foreground">
                {onlyOpen ? t("platform.noRoomSpace") : t("platform.noRooms")}{" "}
                {t("platform.inviteRoomHelp")}
              </p>
              <Button
                variant="outline"
                disabled={disabled}
                onClick={() => setOpen(true)}
              >
                {t("platform.createFirstRoom")}
              </Button>
            </Card>
          )
        )}
      </section>
      <p className="text-muted-foreground flex items-start gap-2 text-sm">
        <LockKeyhole aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        {t("platform.privateInviteHelp")}
      </p>
    </div>
  );
}
