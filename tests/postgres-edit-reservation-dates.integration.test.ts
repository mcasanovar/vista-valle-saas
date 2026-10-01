import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { RoomLockConflictError } from "@/features/availability";
import {
  editReservationDates,
  type ReservationDateEditRoomRate,
} from "@/features/reservations/edit-reservation-dates";
import {
  editReservationStay,
  ReservationStayRequiresRoomError,
} from "@/features/reservations/edit-reservation-stay";
import {
  getAdminReservationDetail,
  listAdminReservations,
} from "@/infrastructure/database/admin-reservation-source";
import { queryAdminCalendar } from "@/infrastructure/database/admin-calendar-source";
import { createDrizzleReservationRepository } from "@/infrastructure/database/reservation-repository";
import {
  createDrizzleRoomLockGateway,
  listOccupyingIntervals,
} from "@/infrastructure/database/room-lock";
import * as schema from "@/persistence/schema";
import {
  auditEvents,
  guests,
  payments,
  reservationItems,
  reservations,
  rooms,
} from "@/persistence/schema";

const adminActorId = "00000000-0000-4000-8000-000000000999";
const integrationUrl = process.env.VISTA_VALLE_POSTGRES_INTEGRATION_URL;
const enabled =
  process.env.POSTGRES_RESERVATION_INTEGRATION_ENABLED === "true" &&
  typeof integrationUrl === "string";

if (!enabled) {
  describe.skip("PostgreSQL edit-reservation-dates integration", () => {
    it("requires the explicit integration runner", () => {});
  });
} else {
  describe("PostgreSQL edit-reservation-dates integration", () => {
    const sql = postgres(integrationUrl!, { max: 4 });
    const db = drizzle(sql, { schema });
    const roomLockGateway = createDrizzleRoomLockGateway(db);
    const reservationRepository = createDrizzleReservationRepository(db);

    afterAll(async () => {
      await sql.end({ timeout: 5 });
    });

    async function insertRoom(id: string, nightlyPriceClp = 60_000) {
      await db.insert(rooms).values({
        active: false,
        baseNightlyPriceClp: nightlyPriceClp,
        capacity: 4,
        id,
      });
    }

    function ratesOf(
      rates: Record<string, number>
    ): (
      roomIds: readonly string[]
    ) => Promise<ReadonlyMap<string, ReservationDateEditRoomRate>> {
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
          email: `edit-dates-${crypto.randomUUID()}@example.test`,
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
      checkIn: string,
      checkOut: string,
      nightlyPriceClp = 60_000,
      nights = 2
    ) {
      const [reservation] = await db
        .insert(reservations)
        .values({
          checkIn,
          checkOut,
          guestId,
          origin: "website",
          paymentMode: "pay_at_property",
          publicId: `VV-edit-dates-${crypto.randomUUID()}`,
          status: "confirmed",
          totalClp: nights * nightlyPriceClp * roomIds.length,
        })
        .returning();
      await db.insert(reservationItems).values(
        roomIds.map((roomId) => ({
          chargesClp: 0,
          guestCount: 2,
          nightlyPriceClp,
          nights,
          reservationId: reservation!.id,
          roomId,
          subtotalClp: nights * nightlyPriceClp,
        }))
      );
      await db.insert(payments).values({
        amountClp: nights * nightlyPriceClp * roomIds.length,
        externalReference: `pending-${reservation!.id}`,
        mode: "pay_at_property",
        provider: "pay_at_property",
        reservationId: reservation!.id,
        status: "pending",
      });
      return reservation!;
    }

    describe("multi-room transaction (task 4.1)", () => {
      it("updates the header and every room item atomically when extending a multi-room reservation", async () => {
        const roomA = "00000000-0000-4000-8000-000000001061";
        const roomB = "00000000-0000-4000-8000-000000001062";
        await insertRoom(roomA);
        await insertRoom(roomB);
        const guest = await insertGuest();
        const reservation = await insertReservation(
          guest.id,
          [roomA, roomB],
          "2042-01-10",
          "2042-01-12"
        );

        const { reservation: updated } = await editReservationDates({
          getRoomRates: ratesOf({ [roomA]: 60_000, [roomB]: 60_000 }),
          input: {
            actorUserId: adminActorId,
            checkIn: "2042-01-10",
            checkOut: "2042-01-15",
            reservationId: reservation.id,
          },
          reservationRepository,
          roomLockGateway,
        });

        expect(updated.checkOut).toBe("2042-01-15");
        expect(updated.items.every((item) => item.nights === 5)).toBe(true);
        const itemRows = await db
          .select()
          .from(reservationItems)
          .where(eq(reservationItems.reservationId, reservation.id));
        expect(itemRows.every((row) => row.nights === 5)).toBe(true);
        expect(itemRows).toHaveLength(2);
      });

      it("rejects a conflicting extension and leaves the reservation, its items and payments untouched", async () => {
        const room = "00000000-0000-4000-8000-000000001071";
        await insertRoom(room);
        const guestA = await insertGuest();
        const target = await insertReservation(
          guestA.id,
          [room],
          "2042-02-10",
          "2042-02-12"
        );
        const guestB = await insertGuest();
        await insertReservation(
          guestB.id,
          [room],
          "2042-02-14",
          "2042-02-16"
        );

        await expect(
          editReservationDates({
            getRoomRates: ratesOf({ [room]: 60_000 }),
            input: {
              actorUserId: adminActorId,
              checkIn: "2042-02-10",
              checkOut: "2042-02-15",
              reservationId: target.id,
            },
            reservationRepository,
            roomLockGateway,
          })
        ).rejects.toBeInstanceOf(RoomLockConflictError);

        const [unchangedReservation] = await db
          .select()
          .from(reservations)
          .where(eq(reservations.id, target.id));
        expect(unchangedReservation).toMatchObject({
          checkIn: "2042-02-10",
          checkOut: "2042-02-12",
        });
        const itemRows = await db
          .select()
          .from(reservationItems)
          .where(eq(reservationItems.reservationId, target.id));
        expect(itemRows[0]).toMatchObject({ nights: 2 });
        const paymentRows = await db
          .select()
          .from(payments)
          .where(eq(payments.reservationId, target.id));
        expect(paymentRows).toHaveLength(1);
        expect(paymentRows[0]).toMatchObject({
          amountClp: 120_000,
          status: "pending",
        });
      });
    });

    describe("payments and audit (task 4.2)", () => {
      it("replaces the pending amount for an unpaid reservation and audits before/after", async () => {
        const room = "00000000-0000-4000-8000-000000001081";
        await insertRoom(room);
        const guest = await insertGuest();
        const reservation = await insertReservation(
          guest.id,
          [room],
          "2042-03-01",
          "2042-03-03"
        );

        await editReservationDates({
          getRoomRates: ratesOf({ [room]: 60_000 }),
          input: {
            actorUserId: adminActorId,
            checkIn: "2042-03-01",
            checkOut: "2042-03-05",
            reservationId: reservation.id,
          },
          reservationRepository,
          roomLockGateway,
        });

        const paymentRows = await db
          .select()
          .from(payments)
          .where(eq(payments.reservationId, reservation.id));
        expect(paymentRows).toHaveLength(1);
        expect(paymentRows[0]).toMatchObject({
          amountClp: 4 * 60_000,
          status: "pending",
        });

        const events = await db
          .select()
          .from(auditEvents)
          .where(eq(auditEvents.entityId, reservation.id));
        const dateChangeEvent = events.find(
          (event) => event.action === "reservation.dates_changed"
        );
        expect(dateChangeEvent).toMatchObject({
          actorUserId: adminActorId,
          before: expect.objectContaining({
            checkIn: "2042-03-01",
            checkOut: "2042-03-03",
          }),
          after: expect.objectContaining({
            checkIn: "2042-03-01",
            checkOut: "2042-03-05",
            totalClp: 4 * 60_000,
          }),
        });
      });

      it("keeps an approved payment untouched and opens a separate balance for an extension", async () => {
        const room = "00000000-0000-4000-8000-000000001082";
        await insertRoom(room);
        const guest = await insertGuest();
        const reservation = await insertReservation(
          guest.id,
          [room],
          "2042-04-01",
          "2042-04-03"
        );
        await db
          .update(payments)
          .set({ status: "approved", receivedAt: new Date() })
          .where(eq(payments.reservationId, reservation.id));

        await editReservationDates({
          getRoomRates: ratesOf({ [room]: 60_000 }),
          input: {
            actorUserId: adminActorId,
            checkIn: "2042-04-01",
            checkOut: "2042-04-05",
            reservationId: reservation.id,
          },
          reservationRepository,
          roomLockGateway,
        });

        const paymentRows = await db
          .select()
          .from(payments)
          .where(eq(payments.reservationId, reservation.id));
        expect(paymentRows).toHaveLength(2);
        const approved = paymentRows.find((row) => row.status === "approved");
        const pending = paymentRows.find((row) => row.status === "pending");
        expect(approved).toMatchObject({ amountClp: 120_000 });
        expect(pending).toMatchObject({ amountClp: 2 * 60_000 });
      });

      it("flags an overpayment without creating a new charge when reducing a paid reservation", async () => {
        const room = "00000000-0000-4000-8000-000000001083";
        await insertRoom(room);
        const guest = await insertGuest();
        const reservation = await insertReservation(
          guest.id,
          [room],
          "2042-05-01",
          "2042-05-06",
          60_000,
          5
        );
        await db
          .update(payments)
          .set({ status: "approved", receivedAt: new Date() })
          .where(eq(payments.reservationId, reservation.id));

        await editReservationDates({
          getRoomRates: ratesOf({ [room]: 60_000 }),
          input: {
            actorUserId: adminActorId,
            checkIn: "2042-05-01",
            checkOut: "2042-05-03",
            reservationId: reservation.id,
          },
          reservationRepository,
          roomLockGateway,
        });

        const paymentRows = await db
          .select()
          .from(payments)
          .where(eq(payments.reservationId, reservation.id));
        expect(paymentRows).toHaveLength(1);
        expect(paymentRows[0]).toMatchObject({
          amountClp: 300_000,
          status: "approved",
        });

        const events = await db
          .select()
          .from(auditEvents)
          .where(eq(auditEvents.entityId, reservation.id));
        expect(
          events.find((event) => event.action === "reservation.dates_changed")
        ).toMatchObject({
          after: expect.objectContaining({ overpaymentClp: 180_000 }),
        });
      });

      it("does not duplicate the pending balance on a retried identical edit", async () => {
        const room = "00000000-0000-4000-8000-000000001084";
        await insertRoom(room);
        const guest = await insertGuest();
        const reservation = await insertReservation(
          guest.id,
          [room],
          "2042-06-01",
          "2042-06-03"
        );

        for (let attempt = 0; attempt < 2; attempt += 1) {
          await editReservationDates({
            getRoomRates: ratesOf({ [room]: 60_000 }),
            input: {
              actorUserId: adminActorId,
              checkIn: "2042-06-01",
              checkOut: "2042-06-05",
              reservationId: reservation.id,
            },
            reservationRepository,
            roomLockGateway,
          });
        }

        const paymentRows = await db
          .select()
          .from(payments)
          .where(eq(payments.reservationId, reservation.id));
        expect(paymentRows).toHaveLength(1);
        expect(paymentRows[0]).toMatchObject({ amountClp: 4 * 60_000 });
      });
    });

    describe("calendar, listing and iCal reflect the new dates (task 3.4)", () => {
      it("shows the edited dates in the calendar, listing, detail and outbound feed source", async () => {
        const room = "00000000-0000-4000-8000-000000001091";
        await insertRoom(room);
        const guest = await insertGuest();
        const reservation = await insertReservation(
          guest.id,
          [room],
          "2042-07-01",
          "2042-07-03"
        );

        await editReservationDates({
          getRoomRates: ratesOf({ [room]: 60_000 }),
          input: {
            actorUserId: adminActorId,
            checkIn: "2042-07-01",
            checkOut: "2042-07-06",
            reservationId: reservation.id,
          },
          reservationRepository,
          roomLockGateway,
        });

        const calendar = await queryAdminCalendar(db, {
          checkIn: "2042-07-01",
          checkOut: "2042-07-10",
        });
        const calendarItem = calendar.items.find(
          (item) => item.sourceId === reservation.id
        );
        expect(calendarItem).toMatchObject({
          checkIn: "2042-07-01",
          checkOut: "2042-07-06",
        });

        const listing = await listAdminReservations(db, {
          page: 1,
          search: guest.email,
        });
        expect(listing.rows[0]).toMatchObject({
          checkIn: "2042-07-01",
          checkOut: "2042-07-06",
        });

        const detail = await getAdminReservationDetail(db, reservation.id);
        expect(detail).toMatchObject({
          checkIn: "2042-07-01",
          checkOut: "2042-07-06",
        });

        const occupying = await listOccupyingIntervals(db, room, new Date());
        const occupancyEntry = occupying.find(
          (entry) => entry.sourceId === reservation.id
        );
        expect(occupancyEntry?.interval).toEqual({
          checkIn: "2042-07-01",
          checkOut: "2042-07-06",
        });
      });
    });

    describe("room-set diff (tasks 1.2, 1.3 and 1.4)", () => {
      it("swaps a room: deletes the outgoing item, inserts the incoming one", async () => {
        const roomA = "00000000-0000-4000-8000-000000001001";
        const roomB = "00000000-0000-4000-8000-000000001002";
        await insertRoom(roomA);
        await insertRoom(roomB, 30_000);
        const guest = await insertGuest();
        const reservation = await insertReservation(
          guest.id,
          [roomA],
          "2043-01-05",
          "2043-01-07"
        );

        await editReservationStay({
          getRoomRates: ratesOf({ [roomB]: 30_000 }),
          input: {
            actorUserId: adminActorId,
            items: [{ guestCount: 2, roomId: roomB }],
            reservationId: reservation.id,
          },
          reservationRepository,
          roomLockGateway,
        });

        const itemRows = await db
          .select()
          .from(reservationItems)
          .where(eq(reservationItems.reservationId, reservation.id));
        expect(itemRows).toHaveLength(1);
        expect(itemRows[0]).toMatchObject({ roomId: roomB, guestCount: 2 });

        // The outgoing room is free again; the incoming one is occupied.
        const occupyingA = await listOccupyingIntervals(db, roomA, new Date());
        expect(
          occupyingA.find((entry) => entry.sourceId === reservation.id)
        ).toBeUndefined();
        const occupyingB = await listOccupyingIntervals(db, roomB, new Date());
        expect(
          occupyingB.find((entry) => entry.sourceId === reservation.id)
        ).toBeDefined();
      });

      it("re-adds a previously removed room without violating the unique index", async () => {
        // The three diff groups are disjoint by construction, so the
        // delete/insert order cannot by itself violate
        // `reservation_items_reservation_room_unique` (verified by
        // inverting the adapter's order: these tests still pass). What this
        // covers is the real risk: removing a room and later bringing it
        // back must reuse that (reservation_id, room_id) pair cleanly,
        // which only holds if the first edit truly deleted the row instead
        // of leaving it behind.
        const roomA = "00000000-0000-4000-8000-000000001011";
        const roomB = "00000000-0000-4000-8000-000000001012";
        await insertRoom(roomA);
        await insertRoom(roomB, 30_000);
        const guest = await insertGuest();
        const reservation = await insertReservation(
          guest.id,
          [roomA, roomB],
          "2043-02-05",
          "2043-02-07"
        );

        // A → out, B → stays with a new occupancy: the delete and the
        // update both target rows of this same reservation.
        await editReservationStay({
          getRoomRates: ratesOf({ [roomB]: 30_000 }),
          input: {
            actorUserId: adminActorId,
            items: [{ guestCount: 3, roomId: roomB }],
            reservationId: reservation.id,
          },
          reservationRepository,
          roomLockGateway,
        });

        const afterRemoval = await db
          .select()
          .from(reservationItems)
          .where(eq(reservationItems.reservationId, reservation.id));
        expect(afterRemoval).toHaveLength(1);
        expect(afterRemoval[0]).toMatchObject({ roomId: roomB, guestCount: 3 });

        // Now bring A back into the same stay: the INSERT must land cleanly
        // on the pair the first edit deleted.
        await editReservationStay({
          getRoomRates: ratesOf({ [roomA]: 60_000, [roomB]: 30_000 }),
          input: {
            actorUserId: adminActorId,
            items: [
              { guestCount: 2, roomId: roomA },
              { guestCount: 3, roomId: roomB },
            ],
            reservationId: reservation.id,
          },
          reservationRepository,
          roomLockGateway,
        });

        const reinstated = await db
          .select()
          .from(reservationItems)
          .where(eq(reservationItems.reservationId, reservation.id));
        expect(reinstated).toHaveLength(2);
        expect(
          reinstated.map((row) => row.roomId).sort()
        ).toEqual([roomA, roomB].sort());
      });

      it("adds a room as a new item without touching the item that stays", async () => {
        const roomA = "00000000-0000-4000-8000-000000001021";
        const roomB = "00000000-0000-4000-8000-000000001022";
        await insertRoom(roomA);
        await insertRoom(roomB, 30_000);
        const guest = await insertGuest();
        const reservation = await insertReservation(
          guest.id,
          [roomA],
          "2043-03-05",
          "2043-03-07"
        );
        const [before] = await db
          .select()
          .from(reservationItems)
          .where(eq(reservationItems.reservationId, reservation.id));

        await editReservationStay({
          getRoomRates: ratesOf({ [roomA]: 60_000, [roomB]: 30_000 }),
          input: {
            actorUserId: adminActorId,
            items: [
              { guestCount: 2, roomId: roomA },
              { guestCount: 2, roomId: roomB },
            ],
            reservationId: reservation.id,
          },
          reservationRepository,
          roomLockGateway,
        });

        const itemRows = await db
          .select()
          .from(reservationItems)
          .where(eq(reservationItems.reservationId, reservation.id));
        expect(itemRows).toHaveLength(2);
        const kept = itemRows.find((row) => row.roomId === roomA);
        expect(kept).toMatchObject({
          id: before!.id,
          guestCount: 2,
          nightlyPriceClp: 60_000,
        });
        const added = itemRows.find((row) => row.roomId === roomB);
        expect(added).toMatchObject({ guestCount: 2, nightlyPriceClp: 30_000 });

        const [header] = await db
          .select()
          .from(reservations)
          .where(eq(reservations.id, reservation.id));
        expect(header!.totalClp).toBe(
          itemRows.reduce((total, row) => total + row.subtotalClp, 0)
        );
      });

      it("removes a room, taking its charges with the row and leaving no orphan", async () => {
        const roomA = "00000000-0000-4000-8000-000000001031";
        const roomB = "00000000-0000-4000-8000-000000001032";
        await insertRoom(roomA);
        await insertRoom(roomB, 30_000);
        const guest = await insertGuest();
        const reservation = await insertReservation(
          guest.id,
          [roomA, roomB],
          "2043-04-05",
          "2043-04-07"
        );
        // Give the outgoing room a charge so its removal must take it along.
        await db
          .update(reservationItems)
          .set({ chargesClp: 15_000, subtotalClp: 75_000 })
          .where(
            and(
              eq(reservationItems.reservationId, reservation.id),
              eq(reservationItems.roomId, roomB)
            )
          );

        await editReservationStay({
          getRoomRates: ratesOf({ [roomA]: 60_000 }),
          input: {
            actorUserId: adminActorId,
            items: [{ guestCount: 2, roomId: roomA }],
            reservationId: reservation.id,
          },
          reservationRepository,
          roomLockGateway,
        });

        const itemRows = await db
          .select()
          .from(reservationItems)
          .where(eq(reservationItems.reservationId, reservation.id));
        expect(itemRows).toHaveLength(1);
        expect(itemRows[0]!.roomId).toBe(roomA);
        // No row anywhere still points at the removed room for this stay.
        const orphans = await db
          .select()
          .from(reservationItems)
          .where(
            and(
              eq(reservationItems.reservationId, reservation.id),
              eq(reservationItems.roomId, roomB)
            )
          );
        expect(orphans).toHaveLength(0);

        const [header] = await db
          .select()
          .from(reservations)
          .where(eq(reservations.id, reservation.id));
        expect(header!.totalClp).toBe(itemRows[0]!.subtotalClp);

        const occupying = await listOccupyingIntervals(db, roomB, new Date());
        expect(
          occupying.find((entry) => entry.sourceId === reservation.id)
        ).toBeUndefined();
      });

      it("updates only the occupancy when the room set does not change", async () => {
        const room = "00000000-0000-4000-8000-000000001041";
        await insertRoom(room);
        const guest = await insertGuest();
        const reservation = await insertReservation(
          guest.id,
          [room],
          "2043-05-05",
          "2043-05-07"
        );
        const [before] = await db
          .select()
          .from(reservationItems)
          .where(eq(reservationItems.reservationId, reservation.id));

        await editReservationStay({
          getRoomRates: ratesOf({ [room]: 60_000 }),
          input: {
            actorUserId: adminActorId,
            items: [{ guestCount: 4, roomId: room }],
            reservationId: reservation.id,
          },
          reservationRepository,
          roomLockGateway,
        });

        const itemRows = await db
          .select()
          .from(reservationItems)
          .where(eq(reservationItems.reservationId, reservation.id));
        expect(itemRows).toHaveLength(1);
        // Same row updated in place, not deleted and re-inserted.
        expect(itemRows[0]).toMatchObject({ id: before!.id, guestCount: 4 });
      });

      it("rejects an edit that would leave the reservation with no rooms", async () => {
        const room = "00000000-0000-4000-8000-000000001051";
        await insertRoom(room);
        const guest = await insertGuest();
        const reservation = await insertReservation(
          guest.id,
          [room],
          "2043-06-05",
          "2043-06-07"
        );

        await expect(
          editReservationStay({
            getRoomRates: ratesOf({ [room]: 60_000 }),
            input: {
              actorUserId: adminActorId,
              items: [],
              reservationId: reservation.id,
            },
            reservationRepository,
            roomLockGateway,
          })
        ).rejects.toBeInstanceOf(ReservationStayRequiresRoomError);

        const itemRows = await db
          .select()
          .from(reservationItems)
          .where(eq(reservationItems.reservationId, reservation.id));
        expect(itemRows).toHaveLength(1);
      });
    });
  });
}
