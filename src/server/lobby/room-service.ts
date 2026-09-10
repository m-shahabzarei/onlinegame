import "server-only";
import { createHash, randomUUID } from "node:crypto";
import {
  activeMembers,
  chooseHost,
  eligibleGame,
  inviteCodeSchema,
  LobbyError,
  lobbyCommandSchema,
  memberConnection,
  ROOM_TTL_MS,
  startBlocker,
  type CommandResult,
  type LobbyCommand,
  type LobbyIdentity,
  type LobbyMember,
  type LobbySnapshot,
  type PublicRoom,
  type RoomAggregate,
  type StoredMember,
} from "@/domain/lobby";
import type {
  MatchSessionService,
  PresenceService,
  RealtimePublisher,
  RoomService,
} from "@/realtime/lobby-contracts";
import type { RoomStateStore, RoomTransaction } from "./store";
import { generateRoomCode } from "./room-code";

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const roomChannel = (id: string) => `tp:room:${hash(id)}`;
export const browserChannel = (slug: string) => `tp:browser:${slug}`;
export class ReservedMatchSessionService implements MatchSessionService {
  reserve() {
    return randomUUID();
  }
}

export class LobbyRoomService implements RoomService {
  constructor(
    readonly store: RoomStateStore,
    readonly presence: PresenceService,
    readonly publisher: RealtimePublisher,
    private matches: MatchSessionService = new ReservedMatchSessionService(),
    private now = () => Date.now(),
    private codeFactory = generateRoomCode,
  ) {}

  private async transaction<T>(
    work: (
      tx: RoomTransaction,
      save: (room: RoomAggregate) => Promise<void>,
    ) => Promise<T>,
  ): Promise<T> {
    let changed = new Map<string, RoomAggregate>();
    const outcome = await this.store.transaction(async (tx) => {
      changed = new Map();
      const save = async (room: RoomAggregate) => {
        room.stateVersion++;
        room.updatedAt = this.now();
        await tx.save(room);
        changed.set(room.id, room);
      };
      try {
        return { value: await work(tx, save), error: null };
      } catch (error) {
        // Commit expiry/disconnect reconciliation even when the requested command is rejected.
        // Infrastructure/reservation failures throw and roll back the entire transaction.
        if (error instanceof LobbyError) return { value: null, error };
        throw error;
      }
    });
    await Promise.all(
      [...changed.values()].flatMap((r) =>
        [
          roomChannel(r.id),
          ...(r.visibility === "PUBLIC" ? [browserChannel(r.game.slug)] : []),
        ].map(async (channel) => {
          try {
            await this.publisher.publish(channel, r.stateVersion);
          } catch {
            console.warn(
              "TwoPlayer room notification failed; snapshot refresh remains available.",
            );
          }
        }),
      ),
    );
    if (outcome.error) throw outcome.error;
    return outcome.value as T;
  }

  private async members(room: RoomAggregate): Promise<LobbyMember[]> {
    const members = activeMembers(room);
    const seen = await this.presence.lastSeen(
      room.id,
      members.map((m) => m.user.id),
    );
    return members.map((m) => ({
      userId: m.user.id,
      displayName: m.user.displayName,
      avatarUrl: m.user.avatarUrl,
      isGuest: m.user.isGuest,
      role: m.role,
      ready: m.ready,
      connection: memberConnection(
        seen[m.user.id] ?? null,
        m.joinedAt,
        this.now(),
      ),
    }));
  }
  private async reconcile(
    room: RoomAggregate,
    save: (room: RoomAggregate) => Promise<void>,
  ) {
    // Once claimed, gameplay owns disconnect policy; lobby leases cannot evict players.
    if (room.status === "IN_MATCH") {
      if (room.matchRuntime && room.matchRuntime.leaseUntil <= this.now()) {
        room.status = "CLOSED";
        room.matchId = null;
        delete room.matchRuntime;
        await save(room);
      }
      return;
    }
    if (!["WAITING", "STARTING"].includes(room.status)) return;
    let changed = false;
    if (room.expiresAt <= this.now()) {
      room.status = "EXPIRED";
      room.matchId = null;
      changed = true;
    } else {
      const states = await this.members(room);
      for (const member of activeMembers(room)) {
        const connection = states.find(
          (m) => m.userId === member.user.id,
        )?.connection;
        if (connection !== "CONNECTED" && member.ready) {
          member.ready = false;
          member.updatedAt = this.now();
          changed = true;
        }
        if (connection === "DISCONNECTED") {
          this.remove(member, "DISCONNECTED");
          changed = true;
        }
      }
      const remaining = activeMembers(room);
      if (!remaining.length) {
        room.status = "CLOSED";
        room.matchId = null;
        changed = true;
      } else if (!remaining.some((m) => m.user.id === room.hostUserId)) {
        this.transfer(room, remaining);
        changed = true;
      }
      if (
        room.status === "STARTING" &&
        states.some((m) => m.connection !== "CONNECTED")
      ) {
        room.status = "WAITING";
        room.matchId = null;
        changed = true;
      }
    }
    if (changed) {
      if (room.status !== "STARTING")
        for (const m of room.members) {
          m.ready = false;
          m.updatedAt = this.now();
        }
      await save(room);
    }
  }
  private transfer(room: RoomAggregate, members: StoredMember[]) {
    const host = chooseHost(members);
    if (!host) {
      room.status = "CLOSED";
      room.matchId = null;
      return;
    }
    room.hostUserId = host.user.id;
    for (const m of room.members) {
      m.role = m.user.id === host.user.id ? "HOST" : "PLAYER";
      m.ready = false;
      m.updatedAt = this.now();
    }
  }
  private remove(member: StoredMember, reason: StoredMember["removalReason"]) {
    member.removedAt = this.now();
    member.removalReason = reason;
    member.ready = false;
    member.updatedAt = this.now();
  }
  private authorize(room: RoomAggregate, userId: string): StoredMember {
    const member = room.members.find((m) => m.user.id === userId);
    if (member?.removalReason === "KICKED") throw new LobbyError("ROOM_KICKED");
    if (member?.removedAt != null) throw new LobbyError("MEMBERSHIP_ENDED");
    if (!member) throw new LobbyError("ROOM_UNAVAILABLE");
    return member;
  }
  private async toSnapshot(
    room: RoomAggregate,
    userId: string,
  ): Promise<LobbySnapshot> {
    this.authorize(room, userId);
    const members = await this.members(room);
    return {
      code: room.code,
      game: {
        slug: room.game.slug,
        name: room.game.name,
        description: room.game.description,
      },
      visibility: room.visibility,
      status: room.status,
      maxPlayers: room.maxPlayers,
      mode: room.mode ?? "coop",
      stateVersion: room.stateVersion,
      observedAt: this.now(),
      expiresAt: room.expiresAt,
      members,
      selfId: userId,
      matchId: room.matchId,
      startBlocker:
        room.status === "WAITING"
          ? startBlocker(members, room.maxPlayers)
          : "The room is no longer waiting.",
    };
  }
  private async availableIdentity(
    tx: RoomTransaction,
    save: (r: RoomAggregate) => Promise<void>,
    userId: string,
    code?: string,
  ) {
    for (const room of await tx.forUser(userId)) {
      await this.reconcile(room, save);
      if (
        room.code !== code &&
        ["WAITING", "STARTING", "IN_MATCH"].includes(room.status) &&
        activeMembers(room).some((m) => m.user.id === userId)
      )
        throw new LobbyError("ALREADY_IN_ROOM");
    }
  }
  async currentRoom(userId: string): Promise<string | null> {
    return this.transaction(async (tx, save) => {
      for (const room of await tx.forUser(userId)) {
        await this.reconcile(room, save);
        if (
          ["WAITING", "STARTING", "IN_MATCH"].includes(room.status) &&
          activeMembers(room).some((m) => m.user.id === userId)
        )
          return room.code;
      }
      return null;
    });
  }
  async snapshot(userId: string, code: string) {
    const parsed = inviteCodeSchema.safeParse(code);
    if (!parsed.success) throw new LobbyError("INVALID_INPUT");
    return this.transaction(async (tx, save) => {
      const room = await tx.byCode(parsed.data);
      if (!room) throw new LobbyError("ROOM_UNAVAILABLE");
      this.authorize(room, userId);
      await this.reconcile(room, save);
      return this.toSnapshot(room, userId);
    });
  }
  async heartbeat(userId: string, code: string | null) {
    if (!code) {
      await this.presence.heartbeat(userId, null);
      return;
    }
    const normalized = inviteCodeSchema.safeParse(code);
    if (!normalized.success) throw new LobbyError("INVALID_INPUT");
    // Maintenance runs before renewal, so returning after grace cannot claim an old host role.
    const roomId = await this.transaction(async (tx, save) => {
      const room = await tx.byCode(normalized.data);
      if (!room) throw new LobbyError("ROOM_UNAVAILABLE");
      this.authorize(room, userId);
      await this.reconcile(room, save);
      this.authorize(room, userId);
      if (!["WAITING", "STARTING"].includes(room.status)) return null;
      return room.id;
    });
    await this.presence.heartbeat(userId, roomId);
  }
  async subscriptionChannel(userId: string, code: string): Promise<string> {
    return this.transaction(async (tx, save) => {
      const room = await tx.byCode(code);
      if (!room) throw new LobbyError("ROOM_UNAVAILABLE");
      this.authorize(room, userId);
      await this.reconcile(room, save);
      this.authorize(room, userId);
      return roomChannel(room.id);
    });
  }
  async list(slug: string): Promise<PublicRoom[]> {
    return this.transaction(async (tx, save) => {
      if (!eligibleGame(await tx.game(slug)))
        throw new LobbyError("GAME_UNAVAILABLE");
      const result: PublicRoom[] = [];
      for (const room of await tx.publicRooms(slug)) {
        await this.reconcile(room, save);
        if (room.status !== "WAITING") continue;
        const members = activeMembers(room);
        const host = members.find((m) => m.user.id === room.hostUserId);
        if (!host) continue;
        result.push({
          code: room.code,
          gameName: room.game.name,
          occupancy: members.length,
          maxPlayers: room.maxPlayers,
          mode: room.mode ?? "coop",
          readyCount: members.filter((m) => m.ready).length,
          host: {
            displayName: host.user.displayName,
            avatarUrl: host.user.avatarUrl,
            isGuest: host.user.isGuest,
          },
          createdAt: room.createdAt,
          status: "WAITING",
        });
      }
      return result;
    });
  }
  async execute(
    identity: LobbyIdentity,
    input: LobbyCommand,
  ): Promise<CommandResult> {
    const parsed = lobbyCommandSchema.safeParse(input);
    if (!parsed.success) throw new LobbyError("INVALID_INPUT");
    const command = parsed.data;
    const key = hash(`${identity.id}:${command.requestId}`);
    const fingerprint = hash(JSON.stringify(command));
    return this.transaction(async (tx, save) => {
      if (command.type === "create") {
        const existing = await tx.byCreationKey(key);
        if (existing) {
          if (existing.receipts[0]?.fingerprint !== fingerprint)
            throw new LobbyError("IDEMPOTENCY_CONFLICT");
          await this.reconcile(existing, save);
          return {
            room: await this.toSnapshot(existing, identity.id),
            code: existing.code,
          };
        }
        await this.availableIdentity(tx, save, identity.id);
        const game = await tx.game(command.slug);
        if (!eligibleGame(game)) throw new LobbyError("GAME_UNAVAILABLE");
        let code = this.codeFactory();
        for (let attempt = 0; await tx.byCode(code); attempt++) {
          if (attempt >= 7) throw new LobbyError("SERVICE_UNAVAILABLE");
          code = this.codeFactory();
        }
        const now = this.now();
        const room: RoomAggregate = {
          id: randomUUID(),
          code,
          game,
          hostUserId: identity.id,
          visibility: command.visibility,
          status: "WAITING",
          maxPlayers: command.mode === "solo" ? 1 : 2,
          mode: command.mode ?? "coop",
          stateVersion: 0,
          createdAt: now,
          updatedAt: now,
          expiresAt: now + ROOM_TTL_MS,
          creationKey: key,
          receipts: [{ key, fingerprint }],
          matchId: null,
          members: [
            {
              user: identity,
              role: "HOST",
              ready: false,
              joinedAt: now,
              updatedAt: now,
              removedAt: null,
              removalReason: null,
            },
          ],
        };
        await save(room);
        return { room: await this.toSnapshot(room, identity.id), code };
      }
      const room = await tx.byCode(command.code);
      if (!room) throw new LobbyError("ROOM_UNAVAILABLE");
      const receipt = room.receipts.find((r) => r.key === key);
      if (receipt) {
        if (receipt.fingerprint !== fingerprint)
          throw new LobbyError("IDEMPOTENCY_CONFLICT");
        await this.reconcile(room, save);
        return {
          room: activeMembers(room).some((m) => m.user.id === identity.id)
            ? await this.toSnapshot(room, identity.id)
            : null,
          code: room.code,
        };
      }
      await this.reconcile(room, save);
      if (command.type === "join") {
        const member = room.members.find((m) => m.user.id === identity.id);
        if (member?.removalReason === "KICKED")
          throw new LobbyError("ROOM_UNAVAILABLE");
        if (member && member.removedAt === null)
          return {
            room: await this.toSnapshot(room, identity.id),
            code: room.code,
          };
        const fail = (
          error:
            | "ROOM_FULL"
            | "ROOM_CLOSED"
            | "ROOM_EXPIRED"
            | "GAME_UNAVAILABLE"
            | "INVALID_TRANSITION",
        ) => {
          throw new LobbyError(
            room.visibility === "PRIVATE" ? "ROOM_UNAVAILABLE" : error,
          );
        };
        if (room.status === "EXPIRED") fail("ROOM_EXPIRED");
        if (room.status === "CLOSED") fail("ROOM_CLOSED");
        if (room.status !== "WAITING") fail("INVALID_TRANSITION");
        if (!eligibleGame(await tx.game(room.game.slug)))
          fail("GAME_UNAVAILABLE");
        if (activeMembers(room).length >= room.maxPlayers) fail("ROOM_FULL");
        await this.availableIdentity(tx, save, identity.id, room.code);
        const fresh: StoredMember = {
          user: identity,
          role: "PLAYER",
          ready: false,
          joinedAt: this.now(),
          updatedAt: this.now(),
          removedAt: null,
          removalReason: null,
        };
        if (member) Object.assign(member, fresh);
        else room.members.push(fresh);
        for (const m of activeMembers(room)) m.ready = false;
      } else {
        const member = this.authorize(room, identity.id);
        if (command.expectedVersion !== room.stateVersion)
          throw new LobbyError("STALE_STATE");
        if (
          ["start", "close", "kick", "cancel"].includes(command.type) &&
          room.hostUserId !== identity.id
        )
          throw new LobbyError("FORBIDDEN");
        if (command.type === "close" && room.status === "CLOSED")
          return {
            room: await this.toSnapshot(room, identity.id),
            code: room.code,
          };
        if (!["WAITING", "STARTING"].includes(room.status))
          throw new LobbyError(
            room.status === "EXPIRED" ? "ROOM_EXPIRED" : "ROOM_CLOSED",
          );
        if (command.type === "leave" || command.type === "kick") {
          const target =
            command.type === "leave"
              ? member
              : activeMembers(room).find(
                  (m) => m.user.id === command.targetUserId,
                );
          if (command.type === "kick" && command.targetUserId === identity.id)
            throw new LobbyError("FORBIDDEN");
          if (target)
            this.remove(target, command.type === "leave" ? "LEFT" : "KICKED");
          room.matchId = null;
          room.status = "WAITING";
          const remaining = activeMembers(room);
          if (!remaining.length || target?.user.id === room.hostUserId)
            this.transfer(room, remaining);
          for (const m of remaining) m.ready = false;
        } else if (command.type === "close") {
          room.status = "CLOSED";
          room.matchId = null;
          for (const m of room.members) m.ready = false;
        } else if (command.type === "cancel") {
          if (room.status !== "STARTING" || room.matchId !== command.matchId)
            throw new LobbyError("INVALID_TRANSITION");
          room.matchId = null;
          room.status = "WAITING";
          for (const m of room.members) m.ready = false;
        } else {
          if (room.status !== "WAITING")
            throw new LobbyError("INVALID_TRANSITION");
          if (command.type === "ready") {
            const self = (await this.members(room)).find(
              (m) => m.userId === identity.id,
            );
            if (self?.connection !== "CONNECTED")
              throw new LobbyError("NOT_READY");
            member.ready = command.ready;
            member.updatedAt = this.now();
          } else {
            if (!eligibleGame(await tx.game(room.game.slug)))
              throw new LobbyError("GAME_UNAVAILABLE");
            if (startBlocker(await this.members(room), room.maxPlayers))
              throw new LobbyError("NOT_READY");
            // Reservation allocation is pure; persistence and status commit together in save().
            const matchId = this.matches.reserve();
            room.matchId = matchId;
            room.status = "STARTING";
          }
        }
      }
      // Retain the creation receipt and latest 127 commands. Older replays fail expectedVersion.
      room.receipts = [
        ...(room.receipts.length ? [room.receipts[0]!] : []),
        ...room.receipts.slice(1).slice(-126),
        { key, fingerprint },
      ];
      await save(room);
      return {
        room:
          command.type === "leave"
            ? null
            : await this.toSnapshot(room, identity.id),
        code: room.code,
      };
    });
  }
}
