import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { createLodgingInterval } from "@/features/availability";
import {
  createManualReservationWith,
  type ManualReservationDependencies,
} from "@/features/admin/manual-reservation";
import type { NotificationOutboxWriter } from "@/features/notifications";
import type { RoomReadSource } from "@/features/rooms";
import {
  createPayAtPropertyReservation,
  transitionReservationState,
} from "@/features/reservations";
import {
  collectPayAtPropertyPayment,
  PendingPayAtPropertyPaymentNotFoundError,
} from "@/infrastructure/database/admin-payment-collection";
import {
  getAdminReservationDetail,
  listAdminReservations,
} from "@/infrastructure/database/admin-reservation-source";
import { createDrizzleGuestRepository } from "@/infrastructure/database/guest-repository";
import { createDrizzleNotificationOutboxWriter } from "@/infrastructure/database/notification-outbox-repository";
import { createDrizzleReservationRepository } from "@/infrastructure/database/reservation-repository";
import {
  createDrizzleRoomLockGateway,
  type ProductionRoomLockTransaction,
} from "@/infrastructure/database/room-lock";
import * as schema from "@/persistence/schema";
import {
  auditEvents,
  channelSyncTasks,
  guests,
  notificationOutbox,
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
  describe.skip("PostgreSQL reservation integration", () => {
    it("requires the explicit integration runner", () => {});
  });
} else {
  describe("PostgreSQL reservation integration", () => {
    const sql = postgres(integrationUrl!, { max: 4 });
    const db = drizzle(sql!, { schema });
    const roomLockGateway = createDrizzleRoomLockGateway(db);
    const guestRepository = createDrizzleGuestRepository();
    const reservationRepository = createDrizzleReservationRepository(db);

    const room = Object.freeze({
      capacity: 2,
      id: "00000000-0000-4000-8000-000000000001",
      nightlyPriceClp: 60_000,
    });
    const concurrentRoom = Object.freeze({
      capacity: 2,
      id: "00000000-0000-4000-8000-000000000002",
      nightlyPriceClp: 60_000,
    });
    const guest = Object.freeze({
      email: "integration@example.test",
      firstName: "Integration",
      guestCount: 2,
      lastName: "Guest",
      phone: "+56 9 1111 1111",
    });

    afterAll(async () => {
      await sql.end({ timeout: 5 });
    });

    async function insertRoom(id: string) {
      await db.insert(rooms).values({
        active: false,
        baseNightlyPriceClp: 60_000,
        capacity: 2,
        id,
      });
    }

    function trustedRoomSource(
      roomRecords: readonly Readonly<{
        capacity: number;
        id: string;
        nightlyPriceClp: number;
      }>[]
    ): RoomReadSource {
      const activeRooms = roomRecords.map((room) => ({
        active: true,
        amenities: ["Amenity"],
        bathroom: "Private",
        bedConfiguration: "Double",
        capacity: room.capacity,
        description: "Trusted production test room",
        id: room.id,
        images: [{ alt: "Room", id: `image-${room.id}`, src: "/room.jpg" }],
        isDemonstration: false,
        name: `Room ${room.id}`,
        nightlyPriceClp: room.nightlyPriceClp,
        occupancyPrices: [],
        slug: `room-${room.id}`,
      }));
      return Object.freeze({
        getActiveBySlug: (slug) =>
          activeRooms.find((room) => room.slug === slug) ?? null,
        listActive: () => activeRooms,
      });
    }

    function manualDependencies(): ManualReservationDependencies<ProductionRoomLockTransaction> {
      return {
        guestRepository,
        notificationOutboxWriter:
          createDrizzleNotificationOutboxWriter("admin@example.test"),
        reservationRepository,
        roomLockGateway,
      };
    }

    it("commits the confirmed reservation and its pending pay-at-property payment atomically", async () => {
      await insertRoom(room.id);
      const result = await createPayAtPropertyReservation({
        charges: [{ amountClp: 10_000, label: "integration charge" }],
        generatePublicId: () => "VV-postgres-atomic",
        guestCandidate: guest,
        guestRepository,
        interval: createLodgingInterval("2026-10-05", "2026-10-08"),
        reservationRepository,
        room,
        roomLockGateway,
      });

      const [reservation] = await db
        .select()
        .from(reservations)
        .where(eq(reservations.id, result.reservation.id));
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.reservationId, result.reservation.id));

      expect(reservation).toMatchObject({
        paymentMode: "pay_at_property",
        status: "confirmed",
        totalClp: 190_000,
      });
      expect(payment).toMatchObject({
        amountClp: 190_000,
        mode: "pay_at_property",
        status: "pending",
      });
    });

    it("persists a manual multi-room reservation, audit event, and outbox intents in one transaction", async () => {
      const roomA = "00000000-0000-4000-8000-000000000011";
      const roomB = "00000000-0000-4000-8000-000000000012";
      await insertRoom(roomA);
      await insertRoom(roomB);
      const result = await createManualReservationWith(
        {
          checkIn: "2031-01-10",
          checkOut: "2031-01-12",
          comment: "Late arrival",
          email: "manual-persistent@example.test",
          firstName: "Manual",
          guestCount: 3,
          invoiceBusinessActivity: "Hospitality",
          invoiceEmail: "invoice-persistent@example.test",
          invoiceName: "Manual SpA",
          invoicePhone: "+56 9 1111 1111",
          invoiceRequested: true,
          invoiceRut: "76.000.543-6",
          lastName: "Persistent",
          origin: "phone",
          phone: "+56 9 2222 2222",
          roomIds: [roomA, roomB],
          totalClp: 1,
        },
        adminActorId,
        trustedRoomSource([
          { capacity: 2, id: roomA, nightlyPriceClp: 60_000 },
          { capacity: 2, id: roomB, nightlyPriceClp: 60_000 },
        ]),
        manualDependencies()
      );

      expect(result.reservation).toMatchObject({
        guestComment: "Late arrival",
        origin: "phone",
        paymentMode: "pay_at_property",
        status: "confirmed",
        totalClp: 240_000,
      });
      expect(result.reservation.items).toHaveLength(2);
      expect(result.reservation.invoiceRequest).toMatchObject({
        email: "invoice-persistent@example.test",
        name: "Manual SpA",
      });
      expect(result.payment.status).toBe("pending");
      expect(
        await db
          .select()
          .from(notificationOutbox)
          .where(eq(notificationOutbox.reservationId, result.reservation.id))
      ).toHaveLength(3);
      expect(
        await db
          .select()
          .from(auditEvents)
          .where(eq(auditEvents.entityId, result.reservation.id))
      ).toEqual([
        expect.objectContaining({
          action: "reservation.manual_created",
          actorUserId: adminActorId,
        }),
      ]);
    });

    it("rolls back guest, reservation, payment, and outbox when manual notification persistence fails", async () => {
      const roomId = "00000000-0000-4000-8000-000000000013";
      await insertRoom(roomId);
      const before = await Promise.all([
        db.select({ id: guests.id }).from(guests),
        db.select({ id: reservations.id }).from(reservations),
        db.select({ id: payments.id }).from(payments),
        db.select({ id: notificationOutbox.id }).from(notificationOutbox),
      ]);
      const failingOutbox: NotificationOutboxWriter<ProductionRoomLockTransaction> =
        {
          writeCompanyQuotationRequested: async () => undefined,
          writePaymentCollected: async () => undefined,
          writeReservationConfirmed: async () => {
            throw new Error("outbox write failed");
          },
        };

      await expect(
        createManualReservationWith(
          {
            checkIn: "2031-02-10",
            checkOut: "2031-02-12",
            email: "manual-rollback@example.test",
            firstName: "Rollback",
            guestCount: 1,
            lastName: "Guest",
            origin: "admin",
            phone: "+56 9 3333 3333",
            roomIds: [roomId],
          },
          adminActorId,
          trustedRoomSource([
            { capacity: 2, id: roomId, nightlyPriceClp: 60_000 },
          ]),
          { ...manualDependencies(), notificationOutboxWriter: failingOutbox }
        )
      ).rejects.toThrow("outbox write failed");

      expect(
        await db
          .select()
          .from(guests)
          .where(eq(guests.email, "manual-rollback@example.test"))
      ).toEqual([]);
      expect(
        await db
          .select()
          .from(reservations)
          .where(eq(reservations.checkIn, "2031-02-10"))
      ).toEqual([]);
      const after = await Promise.all([
        db.select({ id: guests.id }).from(guests),
        db.select({ id: reservations.id }).from(reservations),
        db.select({ id: payments.id }).from(payments),
        db.select({ id: notificationOutbox.id }).from(notificationOutbox),
      ]);
      expect(after).toEqual(before);
    });

    it("rejects a manual overlap without creating a second guest, payment, or outbox event", async () => {
      const roomId = "00000000-0000-4000-8000-000000000014";
      await insertRoom(roomId);
      const source = trustedRoomSource([
        { capacity: 2, id: roomId, nightlyPriceClp: 60_000 },
      ]);
      const candidate = {
        checkIn: "2031-03-10",
        checkOut: "2031-03-12",
        email: "manual-conflict@example.test",
        firstName: "Conflict",
        guestCount: 1,
        lastName: "Guest",
        origin: "whatsapp",
        phone: "+56 9 4444 4444",
        roomIds: [roomId],
      };
      const first = await createManualReservationWith(
        candidate,
        adminActorId,
        source,
        manualDependencies()
      );

      await expect(
        createManualReservationWith(
          candidate,
          adminActorId,
          source,
          manualDependencies()
        )
      ).rejects.toThrow();

      expect(
        await db
          .select({ id: guests.id })
          .from(guests)
          .where(eq(guests.email, candidate.email))
      ).toHaveLength(1);
      expect(
        await db
          .select({ id: payments.id })
          .from(payments)
          .where(eq(payments.reservationId, first.reservation.id))
      ).toHaveLength(1);
      expect(
        await db
          .select({ id: notificationOutbox.id })
          .from(notificationOutbox)
          .where(eq(notificationOutbox.reservationId, first.reservation.id))
      ).toHaveLength(2);
    });

    it("locks the room row so exactly one concurrent overlapping reservation commits", async () => {
      await insertRoom(concurrentRoom.id);
      const attempt = (suffix: string) =>
        createPayAtPropertyReservation({
          generatePublicId: () => `VV-postgres-concurrent-${suffix}`,
          guestCandidate: guest,
          guestRepository,
          interval: createLodgingInterval("2026-11-01", "2026-11-05"),
          reservationRepository,
          room: concurrentRoom,
          roomLockGateway,
        });

      const attempts = await Promise.allSettled([attempt("a"), attempt("b")]);
      expect(attempts.map((attempt) => attempt.status).sort()).toEqual([
        "fulfilled",
        "rejected",
      ]);

      const persisted = await db
        .select({ id: reservations.id })
        .from(reservations)
        .innerJoin(
          reservationItems,
          eq(reservationItems.reservationId, reservations.id)
        )
        .where(
          and(
            eq(reservationItems.roomId, concurrentRoom.id),
            eq(reservations.status, "confirmed")
          )
        );
      expect(persisted).toHaveLength(1);
    });

    async function insertGuest(
      overrides: Partial<typeof guests.$inferInsert> = {}
    ) {
      const [row] = await db
        .insert(guests)
        .values({
          email: "admin-source@example.test",
          firstName: "Ana",
          lastName: "Prueba",
          phone: "+56 9 2222 2222",
          ...overrides,
        })
        .returning();
      return row!;
    }

    async function insertReservation(
      overrides: Partial<typeof reservations.$inferInsert> & {
        guestId: string;
      }
    ) {
      const [row] = await db
        .insert(reservations)
        .values({
          checkIn: "2026-12-01",
          checkOut: "2026-12-03",
          origin: "website",
          paymentMode: "pay_at_property",
          publicId: `VV-admin-source-${crypto.randomUUID()}`,
          status: "confirmed",
          totalClp: 100_000,
          ...overrides,
        })
        .returning();
      return row!;
    }

    describe("admin reservation source", () => {
      it("paginates one row per reservation regardless of how many rooms it has", async () => {
        const roomA = "00000000-0000-4000-8000-000000000201";
        const roomB = "00000000-0000-4000-8000-000000000202";
        await insertRoom(roomA);
        await insertRoom(roomB);

        const guestOne = await insertGuest({
          email: "pagination-one@example.test",
        });
        const guestTwo = await insertGuest({
          email: "pagination-two@example.test",
        });
        const guestThree = await insertGuest({
          email: "pagination-three@example.test",
        });

        const multiRoomReservation = await insertReservation({
          checkIn: "2026-12-10",
          checkOut: "2026-12-12",
          guestId: guestOne.id,
          totalClp: 200_000,
        });
        await db.insert(reservationItems).values([
          {
            chargesClp: 0,
            nightlyPriceClp: 60_000,
            nights: 2,
            reservationId: multiRoomReservation.id,
            roomId: roomA,
            subtotalClp: 120_000,
          },
          {
            chargesClp: 0,
            nightlyPriceClp: 40_000,
            nights: 2,
            reservationId: multiRoomReservation.id,
            roomId: roomB,
            subtotalClp: 80_000,
          },
        ]);

        const secondReservation = await insertReservation({
          checkIn: "2026-12-10",
          checkOut: "2026-12-11",
          guestId: guestTwo.id,
        });
        await db.insert(reservationItems).values({
          chargesClp: 0,
          nightlyPriceClp: 60_000,
          nights: 1,
          reservationId: secondReservation.id,
          roomId: roomA,
          subtotalClp: 60_000,
        });

        const thirdReservation = await insertReservation({
          checkIn: "2026-12-10",
          checkOut: "2026-12-11",
          guestId: guestThree.id,
        });
        await db.insert(reservationItems).values({
          chargesClp: 0,
          nightlyPriceClp: 60_000,
          nights: 1,
          reservationId: thirdReservation.id,
          roomId: roomB,
          subtotalClp: 60_000,
        });

        const dateFilter = {
          checkIn: { from: "2026-12-10", to: "2026-12-10" },
          page: 1,
          pageSize: 2,
        };

        const firstPage = await listAdminReservations(db, dateFilter);
        expect(firstPage.total).toBe(3);
        expect(firstPage.rows).toHaveLength(2);
        expect(new Set(firstPage.rows.map((row) => row.id)).size).toBe(2);

        const secondPage = await listAdminReservations(db, {
          ...dateFilter,
          page: 2,
        });
        expect(secondPage.rows).toHaveLength(1);

        const allIds = [...firstPage.rows, ...secondPage.rows].map(
          (row) => row.id
        );
        expect(new Set(allIds).size).toBe(3);
        expect(allIds.sort()).toEqual(
          [
            multiRoomReservation.id,
            secondReservation.id,
            thirdReservation.id,
          ].sort()
        );

        const multiRoomRow = [...firstPage.rows, ...secondPage.rows].find(
          (row) => row.id === multiRoomReservation.id
        );
        expect(multiRoomRow?.rooms).toHaveLength(2);
      });

      it("finds a reservation by guest email, publicId, and room name via free-text search, but never by guest comment", async () => {
        const room = "00000000-0000-4000-8000-000000000203";
        await insertRoom(room);
        await db
          .update(rooms)
          .set({ name: "Habitación Búsqueda Única" })
          .where(eq(rooms.id, room));

        const searchGuest = await insertGuest({
          email: "buscable@example.test",
          firstName: "Encontrable",
          lastName: "Apellido",
        });
        const searchReservation = await insertReservation({
          checkIn: "2027-01-15",
          checkOut: "2027-01-16",
          guestComment: "vista al mar por favor",
          guestId: searchGuest.id,
          publicId: "VV-search-unique-marker",
        });
        await db.insert(reservationItems).values({
          chargesClp: 0,
          nightlyPriceClp: 60_000,
          nights: 1,
          reservationId: searchReservation.id,
          roomId: room,
          subtotalClp: 60_000,
        });

        const byEmail = await listAdminReservations(db, {
          page: 1,
          search: "buscable@example.test",
        });
        expect(byEmail.rows.map((row) => row.id)).toContain(
          searchReservation.id
        );

        const byPublicId = await listAdminReservations(db, {
          page: 1,
          search: "search-unique-marker",
        });
        expect(byPublicId.rows.map((row) => row.id)).toContain(
          searchReservation.id
        );

        const byRoomName = await listAdminReservations(db, {
          page: 1,
          search: "Búsqueda Única",
        });
        expect(byRoomName.rows.map((row) => row.id)).toContain(
          searchReservation.id
        );

        const byComment = await listAdminReservations(db, {
          page: 1,
          search: "vista al mar",
        });
        expect(byComment.rows.map((row) => row.id)).not.toContain(
          searchReservation.id
        );

        const byFullName = await listAdminReservations(db, {
          page: 1,
          search: "Encontrable Apellido",
        });
        expect(byFullName.rows.map((row) => row.id)).toContain(
          searchReservation.id
        );
      });

      it("reports the listing payment status as paid only once a payment is approved", async () => {
        const room = "00000000-0000-4000-8000-000000000206";
        await insertRoom(room);

        const pendingGuest = await insertGuest({
          email: "pending-payment@example.test",
        });
        const pendingReservation = await insertReservation({
          guestId: pendingGuest.id,
        });
        await db.insert(reservationItems).values({
          chargesClp: 0,
          nightlyPriceClp: 60_000,
          nights: 2,
          reservationId: pendingReservation.id,
          roomId: room,
          subtotalClp: 120_000,
        });
        await db.insert(payments).values({
          amountClp: 120_000,
          externalReference: `pending-${pendingReservation.id}`,
          mode: "pay_at_property",
          provider: "pay_at_property",
          reservationId: pendingReservation.id,
          status: "pending",
        });

        const paidGuest = await insertGuest({
          email: "paid-payment@example.test",
        });
        const paidReservation = await insertReservation({
          guestId: paidGuest.id,
        });
        await db.insert(reservationItems).values({
          chargesClp: 0,
          nightlyPriceClp: 60_000,
          nights: 2,
          reservationId: paidReservation.id,
          roomId: room,
          subtotalClp: 120_000,
        });
        await db.insert(payments).values({
          amountClp: 120_000,
          externalReference: `paid-${paidReservation.id}`,
          mode: "pay_now",
          provider: "fintoc",
          providerPaymentId: `pi_${paidReservation.id}`,
          reservationId: paidReservation.id,
          status: "approved",
        });

        const pendingResult = await listAdminReservations(db, {
          page: 1,
          search: "pending-payment@example.test",
        });
        expect(pendingResult.rows[0]?.paymentStatus).toBe("pending");

        const paidResult = await listAdminReservations(db, {
          page: 1,
          search: "paid-payment@example.test",
        });
        expect(paidResult.rows[0]?.paymentStatus).toBe("paid");
      });

      it("combines check-in and check-out range filters with AND", async () => {
        const room = "00000000-0000-4000-8000-000000000204";
        await insertRoom(room);
        const guestForRange = await insertGuest({
          email: "range@example.test",
        });
        const inRange = await insertReservation({
          checkIn: "2027-02-05",
          checkOut: "2027-02-07",
          guestId: guestForRange.id,
        });
        await db.insert(reservationItems).values({
          chargesClp: 0,
          nightlyPriceClp: 60_000,
          nights: 2,
          reservationId: inRange.id,
          roomId: room,
          subtotalClp: 120_000,
        });
        const outOfCheckOutRange = await insertReservation({
          checkIn: "2027-02-05",
          checkOut: "2027-02-20",
          guestId: guestForRange.id,
        });
        await db.insert(reservationItems).values({
          chargesClp: 0,
          nightlyPriceClp: 60_000,
          nights: 15,
          reservationId: outOfCheckOutRange.id,
          roomId: room,
          subtotalClp: 900_000,
        });

        const result = await listAdminReservations(db, {
          checkIn: { from: "2027-02-05", to: "2027-02-05" },
          checkOut: { from: "2027-02-06", to: "2027-02-10" },
          page: 1,
        });

        const ids = result.rows.map((row) => row.id);
        expect(ids).toContain(inRange.id);
        expect(ids).not.toContain(outOfCheckOutRange.id);
      });

      it("returns the full detail of a reservation including invoice, payment, channel sync, and audit trail", async () => {
        const room = "00000000-0000-4000-8000-000000000205";
        await insertRoom(room);
        const detailGuest = await insertGuest({
          company: "Empresa Detalle SpA",
          email: "detalle@example.test",
          rut: "11.111.111-1",
        });
        const detailReservation = await insertReservation({
          checkIn: "2027-03-01",
          checkOut: "2027-03-04",
          guestId: detailGuest.id,
          invoiceBusinessActivity: "Servicios de alojamiento",
          invoiceEmail: "factura@example.test",
          invoiceName: "Empresa Detalle SpA",
          invoicePhone: "+56 9 3333 3333",
          invoiceRequested: true,
          invoiceRut: "76.111.111-1",
          totalClp: 180_000,
        });
        await db.insert(reservationItems).values({
          chargesClp: 0,
          nightlyPriceClp: 60_000,
          nights: 3,
          reservationId: detailReservation.id,
          roomId: room,
          subtotalClp: 180_000,
        });
        const [paymentRow] = await db
          .insert(payments)
          .values({
            amountClp: 180_000,
            externalReference: `detail-${detailReservation.id}`,
            mode: "pay_at_property",
            paymentMethod: "efectivo",
            provider: "pay_at_property",
            receivedAt: new Date("2027-03-06T15:00:00.000Z"),
            reservationId: detailReservation.id,
            status: "approved",
          })
          .returning();
        await db.insert(channelSyncTasks).values({
          channel: "airbnb",
          reservationId: detailReservation.id,
          status: "pending",
        });
        await db.insert(auditEvents).values({
          action: "reservation.state_changed",
          after: { status: "confirmed" },
          before: { status: "confirmed" },
          entityId: detailReservation.id,
          entityType: "reservation",
        });

        const detail = await getAdminReservationDetail(
          db,
          detailReservation.id
        );

        expect(detail?.guest).toMatchObject({
          company: "Empresa Detalle SpA",
          email: "detalle@example.test",
        });
        expect(detail?.items).toHaveLength(1);
        expect(detail?.items[0]).toMatchObject({
          roomId: room,
          subtotalClp: 180_000,
        });
        expect(detail?.invoiceRequest).toMatchObject({
          name: "Empresa Detalle SpA",
          rut: "76.111.111-1",
        });
        expect(detail?.payments).toHaveLength(1);
        expect(detail?.payments[0]).toMatchObject({
          id: paymentRow!.id,
          paymentMethod: "efectivo",
          status: "approved",
        });
        expect(detail?.channelSyncTasks).toEqual([
          expect.objectContaining({ channel: "airbnb", status: "pending" }),
        ]);
        expect(detail?.auditEvents).toHaveLength(1);
        expect(detail?.auditEvents[0]).toMatchObject({
          action: "reservation.state_changed",
        });
      });
    });

    describe("admin reservation actions", () => {
      it("cancels a confirmed reservation whose check-in date already passed, same as a future one", async () => {
        const pastRoom = "00000000-0000-4000-8000-000000000301";
        await insertRoom(pastRoom);
        const result = await createPayAtPropertyReservation({
          generatePublicId: () => "VV-postgres-past-cancel",
          guestCandidate: guest,
          guestRepository,
          interval: createLodgingInterval("2020-01-05", "2020-01-08"),
          reservationRepository,
          room: { id: pastRoom, capacity: 2, nightlyPriceClp: 60_000 },
          roomLockGateway,
        });

        const updated = await transitionReservationState({
          actorUserId: adminActorId,
          reservationId: result.reservation.id,
          reservationRepository,
          roomLockGateway,
          to: "cancelled",
        });

        expect(updated.status).toBe("cancelled");
      });

      it("marks a confirmed reservation as no_show", async () => {
        const noShowRoom = "00000000-0000-4000-8000-000000000302";
        await insertRoom(noShowRoom);
        const result = await createPayAtPropertyReservation({
          generatePublicId: () => "VV-postgres-no-show",
          guestCandidate: guest,
          guestRepository,
          interval: createLodgingInterval("2026-09-05", "2026-09-08"),
          reservationRepository,
          room: { id: noShowRoom, capacity: 2, nightlyPriceClp: 60_000 },
          roomLockGateway,
        });

        const updated = await transitionReservationState({
          actorUserId: adminActorId,
          reservationId: result.reservation.id,
          reservationRepository,
          roomLockGateway,
          to: "no_show",
        });

        expect(updated.status).toBe("no_show");
      });

      it("collects a pay-at-property payment days after the stay ended, with no date restriction", async () => {
        const lateRoom = "00000000-0000-4000-8000-000000000303";
        await insertRoom(lateRoom);
        const result = await createPayAtPropertyReservation({
          generatePublicId: () => "VV-postgres-late-payment",
          guestCandidate: guest,
          guestRepository,
          interval: createLodgingInterval("2020-02-01", "2020-02-03"),
          reservationRepository,
          room: { id: lateRoom, capacity: 2, nightlyPriceClp: 60_000 },
          roomLockGateway,
        });

        const updated = await collectPayAtPropertyPayment(
          db,
          result.reservation.id,
          {
            amountClp: result.payment.amountClp,
            collectedOn: "2020-03-15",
            medium: "efectivo",
            recordedByUserId: adminActorId,
          }
        );

        expect(updated.status).toBe("approved");
        expect(updated.paymentMethod).toBe("efectivo");
      });

      it("does not offer payment collection for a reservation with no pending pay-at-property payment (e.g. paid online)", async () => {
        const onlineRoom = "00000000-0000-4000-8000-000000000304";
        await insertRoom(onlineRoom);
        const onlineGuest = await insertGuest({
          email: "online-paid@example.test",
        });
        const onlineReservation = await insertReservation({
          checkIn: "2027-04-01",
          checkOut: "2027-04-03",
          guestId: onlineGuest.id,
          paymentMode: "pay_now",
        });
        await db.insert(reservationItems).values({
          chargesClp: 0,
          nightlyPriceClp: 60_000,
          nights: 2,
          reservationId: onlineReservation.id,
          roomId: onlineRoom,
          subtotalClp: 120_000,
        });
        await db.insert(payments).values({
          amountClp: 120_000,
          externalReference: `online-${onlineReservation.id}`,
          mode: "pay_now",
          provider: "fintoc",
          providerPaymentId: `pi_${onlineReservation.id}`,
          reservationId: onlineReservation.id,
          status: "approved",
        });

        await expect(
          collectPayAtPropertyPayment(db, onlineReservation.id, {
            amountClp: 120_000,
            collectedOn: "2027-04-05",
            medium: "efectivo",
            recordedByUserId: adminActorId,
          })
        ).rejects.toBeInstanceOf(PendingPayAtPropertyPaymentNotFoundError);
      });
    });

    it("rejects a second reservation with the same (externalPlatform, externalRef) pair", async () => {
      const externalRoom = "00000000-0000-4000-8000-000000000003";
      await insertRoom(externalRoom);
      const [insertedGuest] = await db
        .insert(guests)
        .values({
          email: "vistavallespa@gmail.com",
          firstName: "Huesped",
          lastName: "Airbnb",
          phone: "+56 9 0000 0000",
        })
        .returning();
      const reservationValues = {
        checkIn: "2026-11-01",
        checkOut: "2026-11-03",
        externalPlatform: "airbnb" as const,
        externalRef: "airbnb-uid-duplicate-test",
        guestId: insertedGuest!.id,
        origin: "airbnb" as const,
        paymentMode: "pay_at_property" as const,
        publicId: "VV-postgres-external-ref-1",
        status: "confirmed" as const,
        totalClp: 120_000,
      };
      await db.insert(reservations).values(reservationValues);

      await expect(
        db.insert(reservations).values({
          ...reservationValues,
          publicId: "VV-postgres-external-ref-2",
        })
      ).rejects.toThrow();
    });
  });
}
