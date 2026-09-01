import "server-only";
import {
  createLodgingInterval,
  addLodgingDays,
  nights,
  RoomLockConflictError,
  checkRoomAvailability,
  type OccupyingInterval,
} from "@/features/availability";
import { mockRoomLockGateway } from "@/features/reservations";
import { getServerEnvironment } from "@/config/server";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDrizzleRoomBlockRepository } from "@/infrastructure/database/room-block-repository";
import { createDrizzleRoomLockGateway } from "@/infrastructure/database/room-lock";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { getRoomReadSource } from "@/features/rooms";

export type RoomBlock = Readonly<{
  id: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  reason: string;
  createdBy: string;
  createdAt: Date;
  removedAt?: Date;
  removedBy?: string;
}>;
export type ManualRoomBlockAuditEvent = Readonly<{
  action: "created" | "removed";
  actor: string;
  at: Date;
  blockId: string;
  confirmedWithConflicts?: boolean;
}>;
export type CreateRoomBlocksInput = Readonly<{
  roomIds: readonly string[];
  checkIn: string;
  checkOut: string;
  reason: string;
}>;
export type RoomBlockConflict = Readonly<{
  roomId: string;
  roomName: string;
  date: string;
  source: OccupyingInterval["source"];
  sourceId: string;
}>;
export type RoomBlockReview =
  | Readonly<{ kind: "clear"; conflicts: readonly [] }>
  | Readonly<{ kind: "conflicts"; conflicts: readonly RoomBlockConflict[] }>;
export type RoomBlockListStatus = "active" | "removed" | "all";
export type RoomBlockListFilter = Readonly<{
  roomId?: string;
  checkIn?: string;
  checkOut?: string;
  reason?: string;
  status?: RoomBlockListStatus;
  page?: number;
  pageSize?: number;
}>;
export type RoomBlockListItem = RoomBlock & Readonly<{ nights: number }>;
export type RoomBlockPage = Readonly<{
  items: readonly RoomBlockListItem[];
  page: number;
  pageSize: number;
  total: number;
}>;
export type RoomBlockDetail = RoomBlockListItem &
  Readonly<{ audit: readonly ManualRoomBlockAuditEvent[] }>;
export class RoomBlockInputError extends Error {
  readonly code = "ROOM_BLOCK_INPUT_INVALID" as const;
}
const blocksKey = Symbol.for("vista-valle.mock.room-blocks");
const auditKey = Symbol.for("vista-valle.mock.room-block-audit-events");
function blocks() {
  const s = globalThis as typeof globalThis & {
    [key: symbol]: RoomBlock[] | undefined;
  };
  return (s[blocksKey] ??= []);
}
function audits() {
  const s = globalThis as typeof globalThis & {
    [key: symbol]: ManualRoomBlockAuditEvent[] | undefined;
  };
  return (s[auditKey] ??= []);
}
function normalize(input: CreateRoomBlocksInput) {
  const roomIds = input.roomIds.map((x) => x.trim());
  if (
    !roomIds.length ||
    roomIds.some((x) => !x) ||
    new Set(roomIds).size !== roomIds.length
  )
    throw new RoomBlockInputError("Selecciona habitaciones distintas.");
  const reason = input.reason.trim();
  if (!reason) throw new RoomBlockInputError("Indica el motivo del bloqueo.");
  return Object.freeze({
    roomIds: Object.freeze([...roomIds].sort()),
    reason,
    interval: createLodgingInterval(input.checkIn, input.checkOut),
  });
}
function item(block: RoomBlock): RoomBlockListItem {
  return Object.freeze({
    ...block,
    nights: nights(block.checkIn, block.checkOut),
  });
}
export type NormalizedRoomBlockListFilter = Readonly<{
  page: number;
  pageSize: number;
  status: RoomBlockListStatus;
  roomId?: string;
  reason?: string;
  interval?: Readonly<{ checkIn: string; checkOut: string }>;
}>;
export function normalizeRoomBlockListFilter(
  input: RoomBlockListFilter = {}
): NormalizedRoomBlockListFilter {
  const page =
      Number.isSafeInteger(input.page) && input.page! > 0 ? input.page! : 1,
    pageSize =
      Number.isSafeInteger(input.pageSize) && input.pageSize! > 0
        ? Math.min(input.pageSize!, 100)
        : 20;
  const status = input.status ?? "active";
  if (!["active", "removed", "all"].includes(status))
    throw new RoomBlockInputError("Estado inválido.");
  if (Boolean(input.checkIn) !== Boolean(input.checkOut))
    throw new RoomBlockInputError("Indica ambas fechas.");
  return {
    page,
    pageSize,
    status,
    roomId: input.roomId?.trim(),
    reason: input.reason?.trim().toLocaleLowerCase(),
    interval: input.checkIn
      ? createLodgingInterval(input.checkIn, input.checkOut!)
      : undefined,
  };
}
export function getManualRoomBlockAuditEvents() {
  return getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT === "mock"
    ? Object.freeze([...audits()])
    : [];
}
export function getManualRoomBlocks() {
  if (getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT !== "mock") return null;
  const store = blocks(),
    events = audits();
  const createMany = async (input: CreateRoomBlocksInput, actor: string) => {
    const value = normalize(input);
    const rooms = await getRoomReadSource();
    const validIds = new Set(rooms.listActive().map((room) => room.id));
    if (value.roomIds.some((roomId) => !validIds.has(roomId)))
      throw new RoomBlockInputError("Selecciona habitaciones válidas.");
    return mockRoomLockGateway.runExclusiveMany(
      value.roomIds,
      value.interval,
      async (context) => {
        const at = new Date();
        const auditStart = events.length;
        const made = value.roomIds.map(
          (roomId) =>
            Object.freeze({
              id: crypto.randomUUID(),
              roomId,
              checkIn: value.interval.checkIn,
              checkOut: value.interval.checkOut,
              reason: value.reason,
              createdBy: actor,
              createdAt: at,
            }) satisfies RoomBlock
        );
        try {
          for (const block of made) {
            store.push(block);
            context.recordOccupancy({
              roomId: block.roomId,
              interval: value.interval,
              source: "block",
              sourceId: block.id,
            });
            events.push(
              Object.freeze({ action: "created", actor, at, blockId: block.id })
            );
          }
        } catch (error) {
          for (const block of made) {
            const index = store.indexOf(block);
            if (index >= 0) store.splice(index, 1);
            context.removeOccupancy("block", block.id, block.roomId);
          }
          events.splice(auditStart);
          throw error;
        }
        return Object.freeze(made);
      }
    );
  };
  return Object.freeze({
    create: (
      x: Readonly<{
        roomId: string;
        checkIn: string;
        checkOut: string;
        reason: string;
      }>,
      actor: string
    ) => createMany({ ...x, roomIds: [x.roomId] }, actor).then((x) => x[0]!),
    createMany,
    listPage: (input: RoomBlockListFilter = {}) => {
      const f = normalizeRoomBlockListFilter(input);
      const rows = store
        .filter((b) => {
          const status =
            f.status === "all" ||
            (f.status === "active" ? !b.removedAt : !!b.removedAt);
          const overlap =
            !f.interval ||
            (b.checkIn < f.interval.checkOut &&
              b.checkOut > f.interval.checkIn);
          return (
            (!f.roomId || b.roomId === f.roomId) &&
            status &&
            (!f.reason || b.reason.toLocaleLowerCase().includes(f.reason)) &&
            overlap
          );
        })
        .sort(
          (a, b) =>
            b.createdAt.getTime() - a.createdAt.getTime() ||
            b.id.localeCompare(a.id)
        );
      const start = (f.page - 1) * f.pageSize;
      return Object.freeze({
        items: Object.freeze(rows.slice(start, start + f.pageSize).map(item)),
        page: f.page,
        pageSize: f.pageSize,
        total: rows.length,
      });
    },
    list: () => Object.freeze(store.filter((block) => !block.removedAt)),
    detail: (id: string) => {
      const b = store.find((x) => x.id === id);
      return b
        ? Object.freeze({
            ...item(b),
            audit: Object.freeze(events.filter((x) => x.blockId === id)),
          })
        : null;
    },
    remove: async (id: string, actor: string) => {
      const current = store.find((x) => x.id === id && !x.removedAt);
      if (!current) throw new Error("Block not found");
      return mockRoomLockGateway.runLocked(current.roomId, async (c) => {
        const at = new Date();
        c.removeOccupancy("block", id);
        const removed = Object.freeze({
          ...current,
          removedAt: at,
          removedBy: actor,
        });
        store.splice(store.indexOf(current), 1, removed);
        events.push(
          Object.freeze({ action: "removed", actor, at, blockId: id })
        );
        return removed;
      });
    },
  });
}
export async function listRoomBlocks(
  input: RoomBlockListFilter = {}
): Promise<RoomBlockPage> {
  const b = createDatabaseBoundary();
  if (b.context === "mock") return getManualRoomBlocks()!.listPage(input);
  return createDrizzleRoomBlockRepository(createProductionDatabase(b)).list(
    normalizeRoomBlockListFilter(input)
  );
}
export async function getRoomBlockDetail(
  id: string
): Promise<RoomBlockDetail | null> {
  const b = createDatabaseBoundary();
  return b.context === "mock"
    ? getManualRoomBlocks()!.detail(id)
    : createDrizzleRoomBlockRepository(createProductionDatabase(b)).detail(id);
}
export async function createRoomBlocks(
  input: CreateRoomBlocksInput,
  actor: string
): Promise<readonly RoomBlock[]> {
  const value = normalize(input),
    b = createDatabaseBoundary();
  const rooms = await getRoomReadSource();
  const validIds = new Set(rooms.listActive().map((room) => room.id));
  if (value.roomIds.some((roomId) => !validIds.has(roomId)))
    throw new RoomBlockInputError("Selecciona habitaciones válidas.");
  if (b.context === "mock")
    return getManualRoomBlocks()!.createMany(input, actor);
  const db = createProductionDatabase(b);
  return createDrizzleRoomLockGateway(db).runExclusiveMany(
    value.roomIds,
    value.interval,
    (tx) => createDrizzleRoomBlockRepository(db).createMany(tx, value, actor)
  );
}
export async function reviewRoomBlocks(input: CreateRoomBlocksInput): Promise<RoomBlockReview> {
  const value = normalize(input);
  const source = await getRoomReadSource();
  const rooms = source.listActive();
  const names = new Map(rooms.map((room) => [room.id, room.name]));
  if (value.roomIds.some((id) => !names.has(id)))
    throw new RoomBlockInputError("Selecciona habitaciones válidas.");
  const boundary = createDatabaseBoundary();
  const gateway = boundary.context === "mock"
    ? mockRoomLockGateway
    : createDrizzleRoomLockGateway(createProductionDatabase(boundary));
  const conflicts: RoomBlockConflict[] = [];
  for (const roomId of value.roomIds) {
    const occupying = await gateway.listOccupyingIntervals?.(roomId) ?? [];
    for (const item of checkRoomAvailability(occupying, value.interval).conflicts) {
      for (let date = item.interval.checkIn; date < item.interval.checkOut && date < value.interval.checkOut;) {
        if (date >= value.interval.checkIn)
          conflicts.push(Object.freeze({ roomId, roomName: names.get(roomId)!, date, source: item.source, sourceId: item.sourceId }));
        date = addLodgingDays(date, 1);
      }
    }
  }
  const unique = [...new Map(conflicts.map((conflict) => [`${conflict.date}:${conflict.roomId}:${conflict.source}:${conflict.sourceId}`, conflict])).values()]
    .sort((a, b) => a.date.localeCompare(b.date) || a.roomName.localeCompare(b.roomName));
  return unique.length ? Object.freeze({ kind: "conflicts", conflicts: Object.freeze(unique) }) : Object.freeze({ kind: "clear", conflicts: [] as const });
}
export async function confirmRoomBlocks(input: CreateRoomBlocksInput, actor: string): Promise<readonly RoomBlock[]> {
  const value = normalize(input);
  const rooms = await getRoomReadSource();
  const validIds = new Set(rooms.listActive().map((room) => room.id));
  if (value.roomIds.some((roomId) => !validIds.has(roomId)))
    throw new RoomBlockInputError("Selecciona habitaciones válidas.");
  const boundary = createDatabaseBoundary();
  if (boundary.context === "mock")
    return mockRoomLockGateway.runLockedMany(value.roomIds, async (context) => {
      const at = new Date();
      const made = value.roomIds.map((roomId) => Object.freeze({ id: crypto.randomUUID(), roomId, checkIn: value.interval.checkIn, checkOut: value.interval.checkOut, reason: value.reason, createdBy: actor, createdAt: at }) satisfies RoomBlock);
      for (const block of made) { blocks().push(block); context.recordOccupancy({ roomId: block.roomId, interval: value.interval, source: "block", sourceId: block.id }); audits().push(Object.freeze({ action: "created", actor, at, blockId: block.id, confirmedWithConflicts: true })); }
      return Object.freeze(made);
    });
  const db = createProductionDatabase(boundary);
  return createDrizzleRoomLockGateway(db).runLockedMany(value.roomIds, (tx) =>
    createDrizzleRoomBlockRepository(db).createMany(tx, value, actor, { confirmedWithConflicts: true })
  );
}
export async function createRoomBlock(
  input: Readonly<{
    roomId: string;
    checkIn: string;
    checkOut: string;
    reason: string;
  }>,
  actor: string
): Promise<RoomBlock> {
  return (
    await createRoomBlocks({ ...input, roomIds: [input.roomId] }, actor)
  )[0]!;
}
export async function removeRoomBlock(
  id: string,
  actor: string
): Promise<RoomBlock> {
  const b = createDatabaseBoundary();
  if (b.context === "mock") return getManualRoomBlocks()!.remove(id, actor);
  return createDrizzleRoomBlockRepository(createProductionDatabase(b)).remove(
    id,
    actor
  );
}
export function toSafeRoomBlockConflict(error: unknown) {
  return error instanceof RoomLockConflictError
    ? Object.freeze({ roomIds: error.roomId ? [error.roomId] : [] })
    : null;
}
