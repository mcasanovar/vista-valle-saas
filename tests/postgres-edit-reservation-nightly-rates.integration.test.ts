import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import {
  createLodgingInterval,
  createMockRoomLockGateway,
} from "@/features/availability";
import { editReservationOrigin } from "@/features/reservations/edit-reservation-origin";
import { createMockReservationRepository } from "@/features/reservations/reservation-repository";
import {
  editReservationNightlyRates,
  InvalidNightlyRateError,
  type ReservationNightlyRateRoomRate,
} from "@/features/reservations/edit-reservation-nightly-rates";
import { getAdminReservationDetail } from "@/infrastructure/database/admin-reservation-source";
import { createDrizzleReservationRepository } from "@/infrastructure/database/reservation-repository";
import { createDrizzleRoomLockGateway } from "@/infrastructure/database/room-lock";
import * as schema from "@/persistence/schema";
import {
  auditEvents,
  guests,
  payments,
  reservationItems,
  reservations,
  rooms,
} from "@/persistence/schema";

const adminActorId = "00000000-0000-4000-8000-000000000998";
const integrationUrl = process.env.VISTA_VALLE_POSTGRES_INTEGRATION_URL;
const enabled =
  process.env.POSTGRES_RESERVATION_INTEGRATION_ENABLED === "true" &&
  typeof integrationUrl === "string";

if (!enabled) {
  describe.skip("PostgreSQL nightly-rate and channel integration", () => {
    it("requires the explicit integration runner", () => {});
  });
} else {
  describe("PostgreSQL nightly-rate and channel integration (task 4.2)", () => {
    const sql = postgres(integrationUrl!, { max: 4 });
    const db = drizzle(sql, { schema });
    const roomLockGateway = createDrizzleRoomLockGateway(db);
    const reservationRepository = createDrizzleReservationRepository(db);

    afterAll(async () => {
      await sql.end({ timeout: 5 });
    });

    async function insertRoom(id: string, nightlyPriceClp = 60_000) {
      await db
        .insert(rooms)
        .values({
          active: false,
          baseNightlyPriceClp: nightlyPriceClp,
          capacity: 4,
          id,
        })
        .onConflictDoNothing();
    }

    function ratesOf(
      rates: Record<string, number>
    ): (
      roomIds: readonly string[]
    ) => Promise<ReadonlyMap<string, ReservationNightlyRateRoomRate>> {
      return async (roomIds) =>
        new Map(
          roomIds.map((roomId) => [
            roomId,
            Object.freeze({
              capacity: 4,
              id: roomId,
              nightlyPriceClp: rates[roomId]!,
              occupancyPrices: [],
            }),
          ])
        );
    }

    async function insertGuest() {
      const [row] = await db
        .insert(guests)
        .values({
          email: `nightly-rate-${crypto.randomUUID()}@example.test`,
          firstName: "Ana",
          lastName: "Prueba",
          phone: "+56 9 2222 2222",
        })
        .returning();
      return row!;
    }

    async function insertReservation(
      guestId: string,
      roomIds: readonly string[],
      params: Readonly<{
        checkIn: string;
        checkOut: string;
        nights: number;
        nightlyPriceClp?: number;
        origin?: "airbnb" | "booking" | "website";
        status?: "confirmed" | "cancelled" | "completed";
      }>
    ) {
      const nightlyPriceClp = params.nightlyPriceClp ?? 60_000;
      const total = params.nights * nightlyPriceClp * roomIds.length;
      const [reservation] = await db
        .insert(reservations)
        .values({
          checkIn: params.checkIn,
          checkOut: params.checkOut,
          guestId,
          origin: params.origin ?? "booking",
          paymentMode: "pay_at_property",
          publicId: `VV-rate-${crypto.randomUUID()}`,
          status: params.status ?? "confirmed",
          totalClp: total,
        })
        .returning();
      await db.insert(reservationItems).values(
        roomIds.map((roomId) => ({
          chargesClp: 0,
          guestCount: 2,
          nightlyPriceClp,
          nights: params.nights,
          reservationId: reservation!.id,
          roomId,
          subtotalClp: params.nights * nightlyPriceClp,
        }))
      );
      await db.insert(payments).values({
        amountClp: total,
        externalReference: `pending-rate-${reservation!.id}`,
        mode: "pay_at_property",
        provider: "pay_at_property",
        reservationId: reservation!.id,
        status: "pending",
      });
      return reservation!;
    }

    it("writes items, total, payment and audit atomically", async () => {
      const room = "00000000-0000-4000-8000-000000002001";
      await insertRoom(room);
      const guest = await insertGuest();
      const reservation = await insertReservation(guest.id, [room], {
        checkIn: "2043-01-10",
        checkOut: "2043-01-13",
        nights: 3,
      });

      const { reservation: updated } = await editReservationNightlyRates({
        getRoomRates: ratesOf({ [room]: 60_000 }),
        input: {
          actorUserId: adminActorId,
          overrides: [{ nightlyPriceClp: 42_000, roomId: room }],
          reservationId: reservation.id,
        },
        reservationRepository,
        roomLockGateway,
      });

      expect(updated.totalClp).toBe(126_000);

      const [itemRow] = await db
        .select()
        .from(reservationItems)
        .where(
          and(
            eq(reservationItems.reservationId, reservation.id),
            eq(reservationItems.roomId, room)
          )
        );
      expect(itemRow?.nightlyPriceClp).toBe(42_000);
      expect(itemRow?.nightlyPriceManual).toBe(true);
      expect(itemRow?.subtotalClp).toBe(126_000);

      const [headerRow] = await db
        .select()
        .from(reservations)
        .where(eq(reservations.id, reservation.id));
      expect(headerRow?.totalClp).toBe(126_000);

      const paymentRows = await db
        .select()
        .from(payments)
        .where(eq(payments.reservationId, reservation.id));
      const pending = paymentRows.filter((row) => row.status === "pending");
      expect(pending).toHaveLength(1);
      expect(pending[0]?.amountClp).toBe(126_000);

      const events = await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.entityId, reservation.id));
      const rateEvent = events.find(
        (event) => event.action === "reservation.nightly_rate_changed"
      );
      expect(rateEvent).toBeDefined();
      expect(rateEvent?.actorUserId).toBe(adminActorId);
      expect(rateEvent?.before).toMatchObject({ totalClp: 180_000 });
      expect(rateEvent?.after).toMatchObject({ totalClp: 126_000 });
    });

    it("surfaces the hand-set value through the admin detail read", async () => {
      const room = "00000000-0000-4000-8000-000000002002";
      await insertRoom(room);
      const guest = await insertGuest();
      const reservation = await insertReservation(guest.id, [room], {
        checkIn: "2043-02-10",
        checkOut: "2043-02-12",
        nights: 2,
      });

      await editReservationNightlyRates({
        getRoomRates: ratesOf({ [room]: 60_000 }),
        input: {
          actorUserId: adminActorId,
          overrides: [{ nightlyPriceClp: 39_000, roomId: room }],
          reservationId: reservation.id,
        },
        reservationRepository,
        roomLockGateway,
      });

      const detail = await getAdminReservationDetail(db, reservation.id);
      const line = detail?.items.find((item) => item.roomId === room);
      expect(line?.nightlyPriceClp).toBe(39_000);
      expect(line?.nightlyPriceManual).toBe(true);
    });

    it("leaves everything untouched when the value is invalid", async () => {
      const room = "00000000-0000-4000-8000-000000002003";
      await insertRoom(room);
      const guest = await insertGuest();
      const reservation = await insertReservation(guest.id, [room], {
        checkIn: "2043-03-10",
        checkOut: "2043-03-12",
        nights: 2,
      });

      await expect(
        editReservationNightlyRates({
          getRoomRates: ratesOf({ [room]: 60_000 }),
          input: {
            actorUserId: adminActorId,
            overrides: [{ nightlyPriceClp: 0, roomId: room }],
            reservationId: reservation.id,
          },
          reservationRepository,
          roomLockGateway,
        })
      ).rejects.toThrow(InvalidNightlyRateError);

      const [itemRow] = await db
        .select()
        .from(reservationItems)
        .where(eq(reservationItems.reservationId, reservation.id));
      expect(itemRow?.nightlyPriceClp).toBe(60_000);
      expect(itemRow?.nightlyPriceManual).toBe(false);
    });

    it("opens no pending balance on a cancelled reservation", async () => {
      const room = "00000000-0000-4000-8000-000000002004";
      await insertRoom(room);
      const guest = await insertGuest();
      const reservation = await insertReservation(guest.id, [room], {
        checkIn: "2043-04-10",
        checkOut: "2043-04-12",
        nights: 2,
        status: "cancelled",
      });
      // Mirrors a real cancellation, which cancels the reservation's payments.
      await db
        .update(payments)
        .set({ status: "cancelled" })
        .where(eq(payments.reservationId, reservation.id));

      await editReservationNightlyRates({
        getRoomRates: ratesOf({ [room]: 60_000 }),
        input: {
          actorUserId: adminActorId,
          overrides: [{ nightlyPriceClp: 95_000, roomId: room }],
          reservationId: reservation.id,
        },
        reservationRepository,
        roomLockGateway,
      });

      const paymentRows = await db
        .select()
        .from(payments)
        .where(eq(payments.reservationId, reservation.id));
      expect(paymentRows.every((row) => row.status === "cancelled")).toBe(true);

      const [headerRow] = await db
        .select()
        .from(reservations)
        .where(eq(reservations.id, reservation.id));
      expect(headerRow?.totalClp).toBe(190_000);
      expect(headerRow?.status).toBe("cancelled");
    });

    it("reports the same record as the in-memory double (task 4.3)", async () => {
      const room = "00000000-0000-4000-8000-000000002006";
      await insertRoom(room);
      const guest = await insertGuest();
      const reservation = await insertReservation(guest.id, [room], {
        checkIn: "2043-06-10",
        checkOut: "2043-06-13",
        nights: 3,
      });

      const { reservation: viaDrizzle } = await editReservationNightlyRates({
        getRoomRates: ratesOf({ [room]: 60_000 }),
        input: {
          actorUserId: adminActorId,
          overrides: [{ nightlyPriceClp: 42_000, roomId: room }],
          reservationId: reservation.id,
        },
        reservationRepository,
        roomLockGateway,
      });

      // The in-memory double, driven through the same use case over an
      // identical starting reservation, must agree on the amounts and the
      // provenance flag - the fields a consumer reads.
      const mockRepository = createMockReservationRepository();
      const mockGateway = createMockRoomLockGateway();
      const interval = createLodgingInterval("2043-06-10", "2043-06-13");
      const { reservation: mockCreated } = await mockGateway.runExclusiveMany(
        [room],
        interval,
        (context) =>
          mockRepository.createConfirmedPayAtPropertyReservation(context, {
            checkIn: interval.checkIn,
            checkOut: interval.checkOut,
            guestCount: 2,
            guestId: "guest-parity",
            items: [
              {
                chargesClp: 0,
                guestCount: 2,
                nightlyPriceClp: 60_000,
                nights: 3,
                roomId: room,
                totalClp: 180_000,
              },
            ],
            origin: "booking",
            publicId: `VV-parity-${crypto.randomUUID()}`,
          })
      );
      const { reservation: viaMock } = await editReservationNightlyRates({
        getRoomRates: ratesOf({ [room]: 60_000 }),
        input: {
          actorUserId: adminActorId,
          overrides: [{ nightlyPriceClp: 42_000, roomId: room }],
          reservationId: mockCreated.id,
        },
        reservationRepository: mockRepository,
        roomLockGateway: mockGateway,
      });

      expect(viaMock.totalClp).toBe(viaDrizzle.totalClp);
      expect(viaMock.items.map((item) => item.nightlyPriceClp)).toEqual(
        viaDrizzle.items.map((item) => item.nightlyPriceClp)
      );
      expect(viaMock.items.map((item) => item.nightlyPriceManual)).toEqual(
        viaDrizzle.items.map((item) => item.nightlyPriceManual)
      );
      expect(viaMock.items.map((item) => item.subtotalClp)).toEqual(
        viaDrizzle.items.map((item) => item.subtotalClp)
      );
    });

    it("drops the hand-set value and reprices when leaving the channel", async () => {
      const room = "00000000-0000-4000-8000-000000002007";
      await insertRoom(room);
      const guest = await insertGuest();
      const reservation = await insertReservation(guest.id, [room], {
        checkIn: "2043-07-10",
        checkOut: "2043-07-13",
        nights: 3,
      });
      await editReservationNightlyRates({
        getRoomRates: ratesOf({ [room]: 60_000 }),
        input: {
          actorUserId: adminActorId,
          overrides: [{ nightlyPriceClp: 42_000, roomId: room }],
          reservationId: reservation.id,
        },
        reservationRepository,
        roomLockGateway,
      });

      const { reservation: updated } = await editReservationOrigin({
        getRoomRates: ratesOf({ [room]: 60_000 }),
        input: {
          actorUserId: adminActorId,
          origin: "admin",
          reservationId: reservation.id,
        },
        reservationRepository,
        roomLockGateway,
      });

      expect(updated.origin).toBe("admin");
      // Back to 3 nights at the room's 60.000 rate, not the dropped 42.000.
      expect(updated.totalClp).toBe(180_000);

      const [itemRow] = await db
        .select()
        .from(reservationItems)
        .where(eq(reservationItems.reservationId, reservation.id));
      expect(itemRow?.nightlyPriceClp).toBe(60_000);
      expect(itemRow?.nightlyPriceManual).toBe(false);

      const [headerRow] = await db
        .select()
        .from(reservations)
        .where(eq(reservations.id, reservation.id));
      expect(headerRow?.origin).toBe("admin");
      expect(headerRow?.totalClp).toBe(180_000);

      const events = await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.entityId, reservation.id));
      const originEvent = events.find(
        (event) => event.action === "reservation.origin_corrected"
      );
      // The audit of a correction that moved money carries both halves.
      expect(originEvent?.before).toMatchObject({
        origin: "booking",
        totalClp: 126_000,
      });
      expect(originEvent?.after).toMatchObject({
        origin: "admin",
        totalClp: 180_000,
      });
    });

    it("corrects the origin and audits it without touching money", async () => {
      const room = "00000000-0000-4000-8000-000000002005";
      await insertRoom(room);
      const guest = await insertGuest();
      const reservation = await insertReservation(guest.id, [room], {
        checkIn: "2043-05-10",
        checkOut: "2043-05-12",
        nights: 2,
        origin: "airbnb",
      });

      const { reservation: updated, financialSummary } =
        await editReservationOrigin({
          input: {
            actorUserId: adminActorId,
            origin: "booking",
            reservationId: reservation.id,
          },
          reservationRepository,
        });

      expect(updated.origin).toBe("booking");
      expect(financialSummary).toBeUndefined();
      expect(updated.totalClp).toBe(reservation.totalClp);

      const [headerRow] = await db
        .select()
        .from(reservations)
        .where(eq(reservations.id, reservation.id));
      expect(headerRow?.origin).toBe("booking");
      // NULL for a manually created reservation, so the
      // reservations_external_ref_consistent check keeps holding.
      expect(headerRow?.externalPlatform).toBeNull();
      expect(headerRow?.externalRef).toBeNull();

      const events = await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.entityId, reservation.id));
      const originEvent = events.find(
        (event) => event.action === "reservation.origin_corrected"
      );
      expect(originEvent?.before).toMatchObject({ origin: "airbnb" });
      expect(originEvent?.after).toMatchObject({ origin: "booking" });
    });
  });
}
