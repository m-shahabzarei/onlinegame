# Domain and persistence model

## Scope

Phase 1 defined the durable multi-game foundation. Phase 2 extends `User` with the minimum account/profile preferences and adds hashed opaque `Session` records for permanent and explicit guest authentication. Room and match models remain structural foundations only; Phase 2 creates or mutates neither.

Pure TypeScript contracts and Zod invariants live in `src/domain`. The relational model lives in `prisma/schema.prisma`. Domain modules intentionally do not import Prisma-generated types so the same product vocabulary can be used by server services and real-time adapters.

## Entity relationships

```mermaid
erDiagram
    USER ||--o{ ROOM : hosts
    USER ||--o{ ROOM_MEMBER : joins
    USER ||--o{ SESSION : authenticates
    GAME ||--o{ ROOM : offers
    ROOM ||--o{ ROOM_MEMBER : contains
    GAME ||--o{ MATCH : identifies
    ROOM ||--o{ MATCH : produces

    USER {
        string id PK
        string username UK
        string displayName
        string avatarUrl nullable
        string email UK_nullable
        string passwordHash nullable
        boolean isGuest
        string bio nullable
        string locale nullable
        boolean reducedMotion
        boolean soundEnabled
        datetime createdAt
        datetime updatedAt
    }

    SESSION {
        string id PK
        string tokenHash UK
        string userId FK
        SessionKind kind
        datetime expiresAt
        datetime createdAt
        datetime updatedAt
    }

    GAME {
        string id PK
        string slug UK
        string name
        string description
        GameStatus status
        int maxPlayers
        string thumbnailUrl nullable
        datetime createdAt
        datetime updatedAt
    }

    ROOM {
        string id PK
        string code UK
        string gameId FK
        string hostUserId FK
        RoomVisibility visibility
        RoomStatus status
        int maxPlayers
        datetime createdAt
        datetime updatedAt
        datetime expiresAt
    }

    ROOM_MEMBER {
        string roomId PK,FK
        string userId PK,FK
        RoomMemberRole role
        boolean ready
        datetime joinedAt
        datetime updatedAt
    }

    MATCH {
        string id PK
        string gameId FK
        string roomId FK
        MatchStatus status
        datetime startedAt nullable
        datetime endedAt nullable
        datetime createdAt
        datetime updatedAt
    }
```

All standalone entity ID fields use Prisma `cuid()` string defaults; `RoomMember` instead uses its two foreign keys as a composite primary key. Timestamps use PostgreSQL/Prisma `DateTime`; domain objects use `Date`; provider-neutral real-time messages represent timestamps as strings by ISO 8601 convention. `IsoDateString` is currently a plain TypeScript alias, so runtime format validation remains future boundary work.

## Entity ownership

| Entity/state                           | Durable owner                                                                        | Live owner                                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `User` account/profile/preferences     | Web application and PostgreSQL                                                       | `AuthService` owns credential/account rules; the real-time service owns connection presence. |
| `Session` login/guest authentication   | Web application and PostgreSQL (database mode)                                       | HTTP-only browser cookie carries the raw opaque value; this is never online presence.        |
| `Game` catalog metadata                | Web application and PostgreSQL                                                       | An active match server reads game/session configuration but does not own catalog records.    |
| `Room` identity and lifecycle metadata | Web control plane and PostgreSQL                                                     | External real-time service owns the current room revision and connected roster.              |
| `RoomMember` association               | Web control plane and PostgreSQL                                                     | External real-time service owns immediate connection/readiness snapshot while live.          |
| `Match` identity and lifecycle history | Web control plane and PostgreSQL, updated from authenticated lifecycle reports later | External real-time service owns the active match session and simulation.                     |

Phase 2 mutates only `User` profile/preference fields and `Session`. Room, member, and match mutation/callback flows remain unimplemented.

## Entities

### User

`User` is the durable platform account/profile. Its optional password hash supports the Phase 2 database auth adapter; it is never a live-presence record and never crosses into a browser DTO.

| Field           | Type/constraint                  | Meaning                                                                                                              |
| --------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `id`            | String, primary key, `cuid()`    | Stable platform user identifier.                                                                                     |
| `username`      | `VarChar(32)`, unique            | Handle. Domain validation accepts 3–32 ASCII letters, digits, or underscores; Phase 2 account services lowercase it. |
| `displayName`   | `VarChar(64)`                    | User-facing name; full localization/content policy is deferred.                                                      |
| `avatarUrl`     | Text, nullable                   | Optional HTTP(S) image reference. Host allow-listing and media ownership are deferred.                               |
| `email`         | `VarChar(320)`, unique, nullable | Lowercased permanent-account login identifier; absent for guests.                                                    |
| `passwordHash`  | Text, nullable                   | Salted encoded `scrypt` hash; absent for guests and omitted from all safe DTOs.                                      |
| `isGuest`       | Boolean, default `false`         | Marks an explicitly temporary guest identity.                                                                        |
| `bio`           | `VarChar(280)`, nullable         | Optional short profile introduction.                                                                                 |
| `locale`        | `VarChar(16)`, nullable          | Stored `en`/`fa` preference; not a complete localization implementation.                                             |
| `reducedMotion` | Boolean, default `false`         | Account preference applied by the authenticated shell; OS `prefers-reduced-motion` is also globally honored.         |
| `soundEnabled`  | Boolean, default `true`          | Preference placeholder for future audio-capable experiences.                                                         |
| `createdAt`     | DateTime, defaults to now        | Creation time.                                                                                                       |
| `updatedAt`     | DateTime, automatically updated  | Last durable update time.                                                                                            |

Relations:

- One user may host many rooms through `Room.hostUserId`.
- One user may belong to many rooms through `RoomMember`.
- One user may own multiple finite sessions; deleting the user cascades its sessions.
- A user with hosted rooms cannot be deleted until those rooms are handled because the host relation uses `Restrict`.
- Deleting an otherwise deletable user removes their membership rows through `Cascade`.

Bans, player statistics, cosmetics, progression, email verification/recovery, and external-provider identities remain absent.

### Session

`Session` is authentication state, not presence. The raw random token is held only by an HTTP-only browser cookie; PostgreSQL stores its SHA-256 digest for lookup/revocation.

| Field       | Type/constraint                 | Meaning                                                                 |
| ----------- | ------------------------------- | ----------------------------------------------------------------------- |
| `id`        | String, primary key, `cuid()`   | Durable session identifier.                                             |
| `tokenHash` | `VarChar(64)`, unique           | SHA-256 digest of the opaque cookie value.                              |
| `userId`    | String, indexed foreign key     | Owning account/guest; user deletion cascades sessions.                  |
| `kind`      | `SessionKind`, default `USER`   | Distinguishes permanent-account sessions from temporary guest sessions. |
| `expiresAt` | DateTime, indexed               | Hard server-side expiry checked on every resolution.                    |
| `createdAt` | DateTime, defaults to now       | Issuance time.                                                          |
| `updatedAt` | DateTime, automatically updated | Last durable update time.                                               |

Indexes on `(userId, expiresAt)` and `expiresAt` support user-session lookup and expiry cleanup. A session says that a browser authenticated recently; it does not say that the player is connected or online.

### Game

`Game` is catalog/configuration metadata for any game offered by the platform. It does not contain executable game logic.

| Field          | Type/constraint                 | Meaning                                                                                                                                 |
| -------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `id`           | String, primary key, `cuid()`   | Stable game identifier.                                                                                                                 |
| `slug`         | `VarChar(64)`, unique           | Route/catalog-safe identity. Slug normalization is deferred to future commands.                                                         |
| `name`         | `VarChar(96)`                   | Display name.                                                                                                                           |
| `description`  | Text                            | Catalog description.                                                                                                                    |
| `status`       | `GameStatus`, default `DRAFT`   | Catalog/lifecycle state.                                                                                                                |
| `maxPlayers`   | Integer, default `2`            | Supported game capacity metadata. The shared capacity validator accepts 2–4, but no Phase 1 command automatically applies it to `Game`. |
| `thumbnailUrl` | Text, nullable                  | Optional catalog artwork reference.                                                                                                     |
| `createdAt`    | DateTime, defaults to now       | Creation time.                                                                                                                          |
| `updatedAt`    | DateTime, automatically updated | Last durable update time.                                                                                                               |

Relations:

- One game owns many rooms and many match records.
- A game referenced by a room or match cannot be deleted (`Restrict`), preserving referential history.

`Game.status` is indexed for catalog filtering. The first zombie shooter can become one row in this table; the schema does not hardcode its mechanics.

### Room

`Room` is durable control-plane metadata: identity, invitation code, game, host, visibility, lifecycle marker, capacity, and expiration. It is not the high-frequency live room snapshot.

| Field        | Type/constraint                     | Meaning                                                                                                                                                |
| ------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`         | String, primary key, `cuid()`       | Stable room identifier shared with the real-time boundary.                                                                                             |
| `code`       | `VarChar(12)`, unique               | Invitation lookup code. Domain validation requires 6–12 uppercase ASCII letters/digits.                                                                |
| `gameId`     | String, foreign key                 | Owning `Game`.                                                                                                                                         |
| `hostUserId` | String, foreign key                 | Hosting `User`.                                                                                                                                        |
| `visibility` | `RoomVisibility`, default `PRIVATE` | Discovery policy marker.                                                                                                                               |
| `status`     | `RoomStatus`, default `WAITING`     | Durable room lifecycle marker.                                                                                                                         |
| `maxPlayers` | Integer, default `2`                | Room-specific capacity. `roomFoundationSchema` accepts 2–4 when explicitly invoked; the plain interface and database column do not enforce that range. |
| `createdAt`  | DateTime, defaults to now           | Creation time.                                                                                                                                         |
| `updatedAt`  | DateTime, automatically updated     | Last durable update time.                                                                                                                              |
| `expiresAt`  | DateTime, required                  | When the room becomes eligible for expiry/cleanup. The caller must choose it.                                                                          |

Relations and deletion behavior:

- `gameId` and `hostUserId` use `Restrict` on delete and `Cascade` on referenced-key update.
- Deleting a room cascades its membership rows.
- Match rows restrict deleting a referenced room, preserving match history.
- A room can have more than one match because `Match.roomId` is indexed but not unique; this leaves room for replay/rematch history.

Indexes support common future control-plane queries:

- `(gameId, status)` for rooms available for a game;
- `(hostUserId, status)` for a host's active/history views; and
- `(status, expiresAt)` for expiry and cleanup scans.

No Phase 2 query or mutation uses these room indexes.

### RoomMember

`RoomMember` represents the durable many-to-many association between rooms and users.

| Field       | Type/constraint                               | Meaning                                          |
| ----------- | --------------------------------------------- | ------------------------------------------------ |
| `roomId`    | String, composite primary key and foreign key | Room identity.                                   |
| `userId`    | String, composite primary key and foreign key | User identity.                                   |
| `role`      | `RoomMemberRole`, default `PLAYER`            | Durable membership role.                         |
| `ready`     | Boolean, default `false`                      | Last durable ready marker, not network presence. |
| `joinedAt`  | DateTime, defaults to now                     | Membership creation time.                        |
| `updatedAt` | DateTime, automatically updated               | Last durable update time.                        |

The composite primary key `(roomId, userId)` prevents duplicate membership for the same user in the same room. A user may still belong to multiple rooms at the database level; active-room exclusivity, if desired, is a future domain/service rule.

Both foreign keys cascade on delete and referenced-key update. Indexes support `(userId, joinedAt)` for a user's memberships and `(roomId, ready)` for readiness summaries.

During a live connection, the external room snapshot is authoritative for connection state and immediate readiness. How that snapshot updates or reconciles the durable `ready` field is deferred; the database must not be polled or updated as a presence channel.

### Match

`Match` is a durable lifecycle/history record that can later anchor results and statistics without creating those tables prematurely.

| Field       | Type/constraint                  | Meaning                                                   |
| ----------- | -------------------------------- | --------------------------------------------------------- |
| `id`        | String, primary key, `cuid()`    | Stable match identifier shared with the session boundary. |
| `gameId`    | String, foreign key              | Game played.                                              |
| `roomId`    | String, foreign key              | Room that produced the match.                             |
| `status`    | `MatchStatus`, default `PENDING` | Durable lifecycle state.                                  |
| `startedAt` | DateTime, nullable               | Authoritative start time once known.                      |
| `endedAt`   | DateTime, nullable               | Authoritative end time once known.                        |
| `createdAt` | DateTime, defaults to now        | Record creation time.                                     |
| `updatedAt` | DateTime, automatically updated  | Last durable update time.                                 |

Both game and room relations use `Restrict` on delete and `Cascade` on referenced-key update. Indexes support `(gameId, status)`, chronological room history via `(roomId, createdAt)`, and status processing via `(status, createdAt)`.

Participant snapshots, scores, statistics, results, rewards, and progression are absent until their product and retention rules are known.

## Enums

### `GameStatus`

| Value         | Intended foundation meaning                                     |
| ------------- | --------------------------------------------------------------- |
| `DRAFT`       | Catalog record is presented as coming soon.                     |
| `ACTIVE`      | Game brief is available to discovery; this does not start play. |
| `MAINTENANCE` | Temporarily unavailable while retaining its identity/history.   |
| `ARCHIVED`    | Retained but no longer offered for new play.                    |

### `RoomVisibility`

| Value     | Intended foundation meaning                                                    |
| --------- | ------------------------------------------------------------------------------ |
| `PUBLIC`  | Eligible for future discovery subject to policy.                               |
| `PRIVATE` | Intended for code/link invitation; this does not itself enforce authorization. |

### `RoomStatus`

| Value      | Intended foundation meaning                       |
| ---------- | ------------------------------------------------- |
| `WAITING`  | Room exists and has not begun a match transition. |
| `STARTING` | Transitional marker while a session is allocated. |
| `IN_MATCH` | A match session is active.                        |
| `CLOSED`   | Room was intentionally closed.                    |
| `EXPIRED`  | Room exceeded its lifetime.                       |

### `RoomMemberRole`

| Value    | Intended foundation meaning    |
| -------- | ------------------------------ |
| `HOST`   | Member has the room-host role. |
| `PLAYER` | Standard member.               |

### `MatchStatus`

| Value       | Intended foundation meaning                                         |
| ----------- | ------------------------------------------------------------------- |
| `PENDING`   | Durable match exists but the authoritative session has not started. |
| `ACTIVE`    | Authoritative session is running.                                   |
| `COMPLETED` | Session completed normally.                                         |
| `ABORTED`   | Session ended without normal completion.                            |

### `SessionKind`

| Value   | Meaning                                                         |
| ------- | --------------------------------------------------------------- |
| `USER`  | Authenticated permanent account session.                        |
| `GUEST` | Explicit temporary guest session with no multiplayer privilege. |

Room and match labels remain storage vocabulary only. Allowed transitions and authorization are not implemented in Phase 2 and must be centralized in services before mutation APIs are added.

## Domain invariants

Zod schemas provide application-boundary checks that SQL scalar types do not fully express:

```text
username:    3..32 characters, ASCII A-Z / a-z / 0-9 / underscore
email:       valid address, lowercased by permanent-account registration
password:    8..128 characters; confirmation must match on registration
displayName: 1..64 trimmed characters
avatar URL:  valid URL or absent
bio:         at most 280 characters or absent
room code:   6..12 characters, uppercase ASCII A-Z / 0-9
capacity:    integer from 2 through 4 inclusive
room input:  valid room code plus valid maxPlayers
```

Tests cover account/profile inputs as well as valid and invalid room codes and capacity. Phase 2 Server Actions invoke the account/profile validators and resolve user ownership from the session. Room validators remain unused foundations and do not constitute a room workflow.

Prisma column lengths, uniqueness, foreign keys, primary keys, defaults, and relations enforce durable structural constraints. Capacity range is not currently a PostgreSQL `CHECK` constraint, so future migrations should consider one if writes may bypass application services.

Domain identifier types (`UserId`, `GameId`, `RoomId`, and `MatchId`) are string aliases rather than nominal/branded types. TypeScript therefore cannot prevent two kinds of ID from being mixed accidentally; input validation and careful mapping remain necessary at service and adapter boundaries.

## Cross-entity rules deferred to services

The schema deliberately avoids encoding uncertain business policy. Future server commands must decide and enforce at least:

- whether usernames and room codes are case-normalized before uniqueness checks;
- that a room's capacity does not exceed its game's supported capacity;
- that the host also has exactly one `HOST` membership row;
- whether a user may be an active member of more than one room;
- that a match's `gameId` equals the referenced room's `gameId`;
- valid room and match state transitions;
- ordering rules for `startedAt`, `endedAt`, and `expiresAt`;
- code generation entropy, collision retries, enumeration protection, and reuse policy;
- who can change visibility, readiness, roles, and status;
- expiry cleanup and the effect of reconnect grace periods; and
- idempotency/version checks when the real-time service reports lifecycle changes.

These are risks to address before exposing mutation endpoints. Phase 1 does not silently guess them.

## Persistent versus real-time ownership

Persist:

- profiles and catalog metadata;
- finite authentication sessions as opaque-token digests, never plaintext tokens;
- room identity, code, host, membership association, lifecycle marker, and expiry;
- match identity, lifecycle status, and start/end times.

Keep transient in the external service:

- online, away, offline, connection IDs, heartbeats, and last-observed connection time;
- live member connection state and current room revision;
- reconnect tokens and transport sessions;
- positions, inputs, health, ammunition, enemies, waves, damage, and simulation ticks.

There is intentionally no `Presence` table. A durable activity or moderation audit, if later required, should be designed as an event/history model with an explicit retention purpose—not as a snapshot named presence.

An authentication `Session` and a real-time transport session solve different problems. The former proves a browser's web identity for ordinary requests; the latter will represent a live connection to an authoritative provider. Neither is evidence that a player is online unless the future presence owner says so.

## Extensibility without premature tables

The current keys allow later tables to reference `User`, `Game`, `Room`, and `Match` for statistics, progression, cosmetics, moderation, and participant/result snapshots. Those tables are not present because their cardinality, privacy, ownership, aggregation, and retention rules depend on later product decisions.

This keeps the first schema useful for multiple games and two-to-four-player rooms without baking the first zombie shooter's weapons, waves, bosses, or upgrades into platform storage.
