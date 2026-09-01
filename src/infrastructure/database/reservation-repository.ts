import "server-only";

import { eq } from "drizzle-orm";

import type {
  ApprovedPayNowPayment,
  PayAtPropertyPayment,
  ReservationRecord,
  ReservationRepository,
} from "@/features/reservations";
import {
  assertConfirmedTransition,
  paymentReference,
  ReservationNotFoundError,
} from "@/features/reservations";
import {
  auditEvents,
  payments,
  reservationItems,
  reservations,
} from "@/persistence/schema";
import type { ProductionDatabase } from "./client";
import type { ProductionRoomLockTransaction } from "./room-lock";

function toReservationRecord(
  row: typeof reservations.$inferSelect,
  items: readonly (typeof reservationItems.$inferSelect)[] = []
): ReservationRecord {
  // This adapter only creates WEBSITE/PAY_AT_PROPERTY reservations. The
  // schema intentionally supports other values for later admin/provider work.
  const mappedItems = Object.freeze(
    items.map((item) =>
      Object.freeze({
        chargesClp: item.chargesClp,
        nightlyPriceClp: item.nightlyPriceClp,
        nights: item.nights,
        roomId: item.roomId,
        subtotalClp: item.subtotalClp,
      })
    )
  );
  const first = mappedItems[0];
  if (!first) throw new Error("Reservation has no room items");
  return Object.freeze({
    ...row,
    guestComment: row.guestComment ?? undefined,
    invoiceRequest: row.invoiceRequested
      ? Object.freeze({
          businessActivity: row.invoiceBusinessActivity!,
          email: row.invoiceEmail!,
          name: row.invoiceName!,
          phone: row.invoicePhone!,
          rut: row.invoiceRut!,
        })
      : undefined,
    items: mappedItems,
    roomId: first.roomId,
    nightlyPriceClp: first.nightlyPriceClp,
    chargesClp: first.chargesClp,
    guestCount: 1,
    origin: row.origin as ReservationRecord["origin"],
    paymentMode: row.paymentMode as ReservationRecord["paymentMode"],
    status: row.status as ReservationRecord["status"],
    externalPlatform:
      (row.externalPlatform as ReservationRecord["externalPlatform"]) ??
      undefined,
    externalRef: row.externalRef ?? undefined,
  });
}

/** PostgreSQL implementation; all writes use the transaction that holds the room row lock. */
export function createDrizzleReservationRepository(
  db: ProductionDatabase
): ReservationRepository<ProductionRoomLockTransaction> {
  return Object.freeze({
    createConfirmedPayAtPropertyReservation: async (tx, input) => {
      const [reservationRow] = await tx
        .insert(reservations)
        .values({
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          guestComment: input.guestComment,
          guestId: input.guestId,
          invoiceBusinessActivity: input.invoiceRequest?.businessActivity,
          invoiceEmail: input.invoiceRequest?.email,
          invoiceName: input.invoiceRequest?.name,
          invoicePhone: input.invoiceRequest?.phone,
          invoiceRequested: Boolean(input.invoiceRequest),
          invoiceRut: input.invoiceRequest?.rut,
          origin: input.origin ?? "website",
          paymentMode: "pay_at_property",
          publicId: input.publicId,
          status: "confirmed",
          totalClp: input.items.reduce(
            (total, item) => total + item.totalClp,
            0
          ),
          externalPlatform: input.externalPlatform,
          externalRef: input.externalRef,
        })
        .returning();
      if (!reservationRow)
        throw new Error("Failed to insert reservation: no row returned");

      const itemRows = await tx
        .insert(reservationItems)
        .values(
          input.items.map((item) => ({
            chargesClp: item.chargesClp,
            nightlyPriceClp: item.nightlyPriceClp,
            nights: item.nights,
            reservationId: reservationRow.id,
            roomId: item.roomId,
            subtotalClp: item.totalClp,
          }))
        )
        .returning();
      const paymentStatus = input.paymentStatus ?? "pending";
      const [paymentRow] = await tx
        .insert(payments)
        .values({
          amountClp: reservationRow.totalClp,
          externalReference: paymentReference(input.publicId),
          mode: "pay_at_property",
          provider: input.paymentProvider ?? "pay_at_property",
          reservationId: reservationRow.id,
          status: paymentStatus,
          receivedAt: paymentStatus === "approved" ? new Date() : undefined,
        })
        .returning({
          amountClp: payments.amountClp,
          currency: payments.currency,
          externalReference: payments.externalReference,
          id: payments.id,
          mode: payments.mode,
          provider: payments.provider,
          reservationId: payments.reservationId,
          status: payments.status,
        });
      if (!paymentRow || !paymentRow.reservationId) {
        throw new Error("Failed to insert pending pay-at-property payment");
      }

      if (input.actorUserId) {
        await tx.insert(auditEvents).values({
          action: "reservation.manual_created",
          actorUserId: input.actorUserId,
          after: {
            origin: input.origin ?? "website",
            paymentStatus: "pending",
            status: "confirmed",
          },
          entityId: reservationRow.id,
          entityType: "reservation",
        });
      }

      return Object.freeze({
        payment: Object.freeze(paymentRow as PayAtPropertyPayment),
        reservation: toReservationRecord(reservationRow, itemRows),
      });
    },
    createConfirmedPayNowReservation: async (tx, input) => {
      const [reservationRow] = await tx
        .insert(reservations)
        .values({
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          guestId: input.guestId,
          origin: "website",
          paymentMode: "pay_now",
          publicId: input.publicId,
          status: "confirmed",
          totalClp: input.item.totalClp,
        })
        .returning();
      if (!reservationRow)
        throw new Error("Failed to insert reservation: no row returned");

      const itemRows = await tx
        .insert(reservationItems)
        .values([
          {
            chargesClp: input.item.chargesClp,
            nightlyPriceClp: input.item.nightlyPriceClp,
            nights: input.item.nights,
            reservationId: reservationRow.id,
            roomId: input.item.roomId,
            subtotalClp: input.item.totalClp,
          },
        ])
        .returning();

      const [paymentRow] = await tx
        .update(payments)
        .set({
          providerPaymentId: input.providerPaymentId,
          reservationId: reservationRow.id,
          status: "approved",
        })
        .where(eq(payments.id, input.paymentId))
        .returning({
          amountClp: payments.amountClp,
          currency: payments.currency,
          externalReference: payments.externalReference,
          id: payments.id,
          mode: payments.mode,
          provider: payments.provider,
          providerPaymentId: payments.providerPaymentId,
          reservationId: payments.reservationId,
          status: payments.status,
        });
      if (
        !paymentRow ||
        !paymentRow.reservationId ||
        !paymentRow.providerPaymentId
      ) {
        throw new Error("Failed to update Fintoc payment as approved");
      }

      return Object.freeze({
        payment: Object.freeze(paymentRow as ApprovedPayNowPayment),
        reservation: toReservationRecord(reservationRow, itemRows),
      });
    },
    getReservationById: async (id) => {
      const [row] = await db
        .select()
        .from(reservations)
        .where(eq(reservations.id, id));
      if (!row) return null;
      const itemRows = await db
        .select()
        .from(reservationItems)
        .where(eq(reservationItems.reservationId, row.id));
      return toReservationRecord(row, itemRows);
    },
    transitionReservationState: async (tx, transition) => {
      const [current] = await tx
        .select()
        .from(reservations)
        .where(eq(reservations.id, transition.reservationId));
      if (!current)
        throw new ReservationNotFoundError(transition.reservationId);
      assertConfirmedTransition(current.status, transition.to);

      const [updated] = await tx
        .update(reservations)
        .set({ status: transition.to, updatedAt: new Date() })
        .where(eq(reservations.id, transition.reservationId))
        .returning();
      if (!updated)
        throw new ReservationNotFoundError(transition.reservationId);

      await tx.insert(auditEvents).values({
        action: "reservation.state_changed",
        actorUserId: transition.actorUserId,
        after: { status: transition.to },
        before: { status: current.status },
        entityId: updated.id,
        entityType: "reservation",
      });
      const itemRows = await tx
        .select()
        .from(reservationItems)
        .where(eq(reservationItems.reservationId, updated.id));
      return toReservationRecord(updated, itemRows);
    },
  });
}
