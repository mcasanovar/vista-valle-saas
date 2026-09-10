import "server-only";
import {
  createLodgingInterval,
  createMockRoomLockGateway,
  type MockRoomLockOperationContext,
} from "@/features/availability";
import {
  type CreateConfirmedPayAtPropertyReservationInput,
  ReservationNotFoundError,
  type ReservationRecord,
  type ReservationRepository,
  type ReservationStateTransition,
  type ReservationStatus,
  transitionReservationState,
} from "@/features/reservations";
import { getServerEnvironment } from "@/config/server";

export type AdminReservation = Readonly<{
  audit: readonly Readonly<{
    actor: string;
    from: ReservationStatus;
    to: Exclude<ReservationStatus, "confirmed">;
    at: Date;
  }>[];
  checkIn: string;
  checkOut: string;
  createdAt: Date;
  guestEmail: string;
  guestName: string;
  guestPhone: string;
  id: string;
  origin: "website";
  room: string;
  roomId: string;
  paymentStatus: "approved" | "pending";
  status: ReservationStatus;
  totalClp: number;
}>;
const initial: AdminReservation = Object.freeze({
  audit: [],
  checkIn: "2026-10-05",
  checkOut: "2026-10-08",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  guestEmail: "guest@example.test",
  guestName: "Huésped demo",
  guestPhone: "+56 9 0000 0000",
  id: "reservation-demo",
  origin: "website",
  room: "Habitación Valle",
  roomId: "room-valle",
  paymentStatus: "pending",
  status: "confirmed",
  totalClp: 1,
});
function domain(record: AdminReservation): ReservationRecord {
  return Object.freeze({
    chargesClp: 0,
    checkIn: record.checkIn,
    checkOut: record.checkOut,
    createdAt: record.createdAt,
    guestCount: 1,
    guestId: `guest-${record.id}`,
    id: record.id,
    nightlyPriceClp: 1,
    items: Object.freeze([
      Object.freeze({
        chargesClp: 0,
        guestCount: 1,
        nightlyPriceClp: 1,
        nights: 3,
        roomId: record.roomId,
        subtotalClp: 1,
      }),
    ]),
    origin: "website",
    paymentMode: "pay_at_property",
    publicId: `VV-${record.id}`,
    roomId: record.roomId,
    status: record.status,
    totalClp: record.totalClp,
    updatedAt: record.createdAt,
  });
}
export function createAdminReservationSource(context: "mock" | "production") {
  if (context !== "mock") return null;
  const records = [initial];
  const roomLockGateway = createMockRoomLockGateway({
    blocks: [],
    holds: [],
    reservations: records.map((r) => ({
      id: r.id,
      roomId: r.roomId,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      status: r.status,
    })),
  });
  const repository: ReservationRepository<MockRoomLockOperationContext> = {
    createConfirmedPayAtPropertyReservation: async (
      _c: MockRoomLockOperationContext,
      _i: CreateConfirmedPayAtPropertyReservationInput
    ) => {
      void _c;
      void _i;
      throw new Error("Unsupported");
    },
    createConfirmedPayNowReservation: async () => {
      throw new Error("Unsupported");
    },
    getReservationById: async (id) => {
      const record = records.find((r) => r.id === id);
      return record ? domain(record) : null;
    },
    transitionReservationState: async (
      operationContext,
      transition: ReservationStateTransition
    ) => {
      const index = records.findIndex((r) => r.id === transition.reservationId);
      if (index < 0)
        throw new ReservationNotFoundError(transition.reservationId);
      const current = records[index];
      if (current.status !== "confirmed")
        throw new Error("Reservation transition unavailable");
      operationContext.removeOccupancy("reservation", current.id);
      const next = Object.freeze({
        ...current,
        status: transition.to,
        audit: Object.freeze([
          ...current.audit,
          Object.freeze({
            actor: transition.actorUserId ?? "unknown",
            from: current.status,
            to: transition.to,
            at: new Date(),
          }),
        ]),
      });
      records.splice(index, 1, next);
      return domain(next);
    },
  };
  return Object.freeze({
    list: (
      filter: Partial<Pick<AdminReservation, "status" | "origin" | "room">> = {}
    ) =>
      records.filter(
        (r) =>
          (!filter.status || r.status === filter.status) &&
          (!filter.origin || r.origin === filter.origin) &&
          (!filter.room || r.room === filter.room)
      ),
    get: (id: string) => records.find((r) => r.id === id) ?? null,
    transition: async (
      id: string,
      to: Exclude<ReservationStatus, "confirmed">,
      actor: string
    ) => {
      await transitionReservationState({
        actorUserId: actor,
        reservationId: id,
        reservationRepository: repository,
        roomLockGateway,
        to,
      });
      const result = records.find((r) => r.id === id);
      if (!result) throw new ReservationNotFoundError(id);
      return result;
    },
    canBookInterval: (roomId: string, checkIn: string, checkOut: string) =>
      roomLockGateway.runExclusive(
        roomId,
        createLodgingInterval(checkIn, checkOut),
        async () => true
      ),
  });
}
export function getAdminReservationSource() {
  return createAdminReservationSource(
    getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT
  );
}
