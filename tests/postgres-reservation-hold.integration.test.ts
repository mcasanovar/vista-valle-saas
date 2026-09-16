import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { createLodgingInterval } from "@/features/availability";
import {
  confirmPayNowReservationFromHold,
  createPaymentHold,
  releaseFailedPayNowHold,
} from "@/features/reservations";
import { createDrizzleFintocPaymentRepository } from "@/infrastructure/database/fintoc-payment-repository";
import { createDrizzleGuestRepository } from "@/infrastructure/database/guest-repository";
import { createDrizzleHoldRepository } from "@/infrastructure/database/hold-repository";
import { createDrizzleReservationRepository } from "@/infrastructure/database/reservation-repository";
import { createDrizzleRoomLockGateway } from "@/infrastructure/database/room-lock";
import * as schema from "@/persistence/schema";
import {
  reservationHoldItems,
  reservationHolds,
  reservationItems,
  rooms,
} from "@/persistence/schema";

const integrationUrl = process.env.VISTA_VALLE_POSTGRES_INTEGRATION_URL;
const enabled =
  process.env.POSTGRES_RESERVATION_INTEGRATION_ENABLED === "true" &&
  typeof integrationUrl === "string";

if (!enabled) {
  describe.skip("PostgreSQL multi-room hold integration", () => {
    it("requires the explicit integration runner", () => {});
  });
} else {
  describe("PostgreSQL multi-room hold integration", () => {
    const sql = postgres(integrationUrl!, { max: 4 });
    const db = drizzle(sql!, { schema });
    const roomLockGateway = createDrizzleRoomLockGateway(db);
    const guestRepository = createDrizzleGuestRepository(db);
    const holdRepository = createDrizzleHoldRepository(db);
    const reservationRepository = createDrizzleReservationRepository(db);
    const paymentRepository = createDrizzleFintocPaymentRepository(db);

    const roomA = Object.freeze({
      capacity: 2,
      id: "00000000-0000-4000-8000-000000000901",
      nightlyPriceClp: 60_000,
    });
    const roomB = Object.freeze({
      capacity: 2,
      id: "00000000-0000-4000-8000-000000000902",
      nightlyPriceClp: 40_000,
    });
    const guest = Object.freeze({
      email: "hold-integration@example.test",
      firstName: "Hold",
      guestCount: 2,
      lastName: "Integration",
      phone: "+56 9 2222 2222",
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

    it("creates a hold covering every selected room, atomically, and persists one item per room", async () => {
      await insertRoom(roomA.id);
      await insertRoom(roomB.id);
      const interval = createLodgingInterval("2031-04-01", "2031-04-04");

      const hold = await createPaymentHold({
        guestCandidate: guest,
        guestRepository,
        holdDurationMinutes: 15,
        holdRepository,
        interval,
        rooms: [roomA, roomB],
        roomLockGateway,
      });

      expect(hold.items).toHaveLength(2);
      expect(hold.totalClp).toBe(3 * 60_000 + 3 * 40_000);

      const persistedItems = await db
        .select()
        .from(reservationHoldItems)
        .where(eq(reservationHoldItems.holdId, hold.id));
      expect(persistedItems).toHaveLength(2);
      expect(persistedItems.map((item) => item.roomId).sort()).toEqual(
        [roomA.id, roomB.id].sort()
      );

      const persistedHold = await holdRepository.getHoldById(hold.id);
      expect(persistedHold?.items).toHaveLength(2);
    });

    it("reverts the entire hold when one of the requested rooms is unavailable", async () => {
      const roomC = Object.freeze({
        capacity: 2,
        id: "00000000-0000-4000-8000-000000000903",
        nightlyPriceClp: 60_000,
      });
      const roomD = Object.freeze({
        capacity: 2,
        id: "00000000-0000-4000-8000-000000000904",
        nightlyPriceClp: 60_000,
      });
      await insertRoom(roomC.id);
      await insertRoom(roomD.id);
      const interval = createLodgingInterval("2031-05-01", "2031-05-04");

      // Occupy roomD ahead of time via its own hold.
      await createPaymentHold({
        guestCandidate: guest,
        guestRepository,
        holdDurationMinutes: 15,
        holdRepository,
        interval,
        rooms: [roomD],
        roomLockGateway,
      });

      await expect(
        createPaymentHold({
          guestCandidate: guest,
          guestRepository,
          holdDurationMinutes: 15,
          holdRepository,
          interval,
          rooms: [roomC, roomD],
          roomLockGateway,
        })
      ).rejects.toThrow();

      const [holdForRoomC] = await db
        .select()
        .from(reservationHoldItems)
        .where(eq(reservationHoldItems.roomId, roomC.id));
      expect(holdForRoomC).toBeUndefined();
    });

    it("confirms a reservation with one item per hold room, releases the hold, and creates a single payment for the total", async () => {
      const roomE = Object.freeze({
        capacity: 2,
        id: "00000000-0000-4000-8000-000000000905",
        nightlyPriceClp: 60_000,
      });
      const roomF = Object.freeze({
        capacity: 2,
        id: "00000000-0000-4000-8000-000000000906",
        nightlyPriceClp: 40_000,
      });
      await insertRoom(roomE.id);
      await insertRoom(roomF.id);
      const interval = createLodgingInterval("2031-06-01", "2031-06-04");

      const hold = await createPaymentHold({
        guestCandidate: guest,
        guestRepository,
        holdDurationMinutes: 15,
        holdRepository,
        interval,
        rooms: [roomE, roomF],
        roomLockGateway,
      });

      const pendingPayment = await paymentRepository.createPendingPayment({
        id: "00000000-0000-4000-8000-000000000299",
        amountClp: hold.totalClp,
        externalReference: "ext-ref-multi-room",
        holdId: hold.id,
        provider: "mercado_pago",
      });

      const confirmed = await confirmPayNowReservationFromHold({
        guestRepository,
        hold,
        holdRepository,
        paymentExternalReference: pendingPayment.externalReference,
        paymentId: pendingPayment.id,
        paymentProvider: "mercado_pago",
        providerPaymentId: "provider-payment-multi-room",
        reservationRepository,
        roomLockGateway,
      });

      expect(confirmed.reservation.items).toHaveLength(2);
      expect(confirmed.payment.amountClp).toBe(hold.totalClp);

      const persistedReservationItems = await db
        .select()
        .from(reservationItems)
        .where(eq(reservationItems.reservationId, confirmed.reservation.id));
      expect(persistedReservationItems).toHaveLength(2);

      await expect(
        db.select().from(reservationHolds).where(eq(reservationHolds.id, hold.id))
      ).resolves.toHaveLength(0);
    });

    it("releases every room of a multi-room hold together when the payment fails", async () => {
      const roomG = Object.freeze({
        capacity: 2,
        id: "00000000-0000-4000-8000-000000000907",
        nightlyPriceClp: 60_000,
      });
      const roomH = Object.freeze({
        capacity: 2,
        id: "00000000-0000-4000-8000-000000000908",
        nightlyPriceClp: 60_000,
      });
      await insertRoom(roomG.id);
      await insertRoom(roomH.id);
      const interval = createLodgingInterval("2031-07-01", "2031-07-04");

      const hold = await createPaymentHold({
        guestCandidate: guest,
        guestRepository,
        holdDurationMinutes: 15,
        holdRepository,
        interval,
        rooms: [roomG, roomH],
        roomLockGateway,
      });

      await releaseFailedPayNowHold({ hold, holdRepository, roomLockGateway });

      await expect(
        db.select().from(reservationHolds).where(eq(reservationHolds.id, hold.id))
      ).resolves.toHaveLength(0);

      // Both rooms must be free again — a second hold for the identical
      // interval on both rooms must succeed.
      const secondHold = await createPaymentHold({
        guestCandidate: guest,
        guestRepository,
        holdDurationMinutes: 15,
        holdRepository,
        interval,
        rooms: [roomG, roomH],
        roomLockGateway,
      });
      expect(secondHold.items).toHaveLength(2);
    });
  });
}
