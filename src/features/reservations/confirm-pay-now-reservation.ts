import { nights, type RoomLockGateway } from "@/features/availability";

import { generateReservationPublicId } from "./create-pay-at-property-reservation";
import { isHoldExpired, type HoldRepository, type ReservationHoldRecord } from "./hold-repository";
import type {
  ApprovedPayNowPayment,
  ReservationRecord,
  ReservationRepository,
} from "./reservation-repository";

export class HoldExpiredError extends Error {
  readonly code = "HOLD_EXPIRED" as const;

  constructor(readonly holdId: string) {
    super(`Reservation hold expired: ${holdId}`);
    this.name = "HoldExpiredError";
  }
}

export type ConfirmPayNowReservationFromHoldParams<TContext> = Readonly<{
  generatePublicId?: () => string;
  hold: ReservationHoldRecord;
  holdRepository: HoldRepository<TContext>;
  now?: () => Date;
  /** e.g. `"fintoc"` or `"mercado_pago"` — the provider whose webhook confirmed this payment. */
  paymentProvider: string;
  paymentExternalReference: string;
  paymentId: string;
  providerPaymentId: string;
  reservationRepository: ReservationRepository<TContext>;
  roomLockGateway: RoomLockGateway<TContext>;
}>;

/**
 * Converts an unexpired hold (one or more rooms, always a single payment
 * for the total — see `add-mercado-pago-checkout-pro` design.md decision
 * 1) into a `CONFIRMED`/`pay_now` reservation once its online payment has
 * succeeded (design.md decision 7 of `build-vista-valle-booking-mvp`:
 * "confirmar en una nueva transacción cuando se agregue ese proveedor").
 * Runs under `RoomLockGateway.runLockedMany` rather than
 * `runExclusiveMany`: the hold already reserved every one of these exact
 * rooms/interval, so there is nothing left to re-validate, only state to
 * change (see `RoomLockGateway`'s doc comment on `runLocked`).
 */
export async function confirmPayNowReservationFromHold<TContext>(
  params: ConfirmPayNowReservationFromHoldParams<TContext>
): Promise<
  Readonly<{ payment: ApprovedPayNowPayment; reservation: ReservationRecord }>
> {
  const {
    generatePublicId = generateReservationPublicId,
    hold,
    holdRepository,
    now = () => new Date(),
    paymentProvider,
    paymentExternalReference,
    paymentId,
    providerPaymentId,
    reservationRepository,
    roomLockGateway,
  } = params;

  if (isHoldExpired(hold, now)) {
    throw new HoldExpiredError(hold.id);
  }

  const holdNights = nights(hold.checkIn, hold.checkOut);

  return roomLockGateway.runLockedMany(
    hold.items.map((item) => item.roomId),
    async (context) => {
      const created = await reservationRepository.createConfirmedPayNowReservation(
        context,
        {
          checkIn: hold.checkIn,
          checkOut: hold.checkOut,
          guestCount: hold.items.reduce((sum, item) => sum + item.guestCount, 0),
          guestId: hold.guestId,
          items: hold.items.map((item) => ({
            chargesClp: item.chargesClp,
            guestCount: item.guestCount,
            nightlyPriceClp: item.nightlyPriceClp,
            nights: holdNights,
            roomId: item.roomId,
            totalClp: item.subtotalClp,
          })),
          paymentExternalReference,
          paymentId,
          paymentProvider,
          providerPaymentId,
          publicId: generatePublicId(),
        }
      );
      await holdRepository.deleteHold(context, hold);
      return created;
    }
  );
}

/** Frees every room of the hold together (never partially), immediately once the hold's online payment definitively fails, instead of waiting for `expiresAt`. */
export async function releaseFailedPayNowHold<TContext>(
  params: Readonly<{
    hold: ReservationHoldRecord;
    holdRepository: HoldRepository<TContext>;
    roomLockGateway: RoomLockGateway<TContext>;
  }>
): Promise<void> {
  const { hold, holdRepository, roomLockGateway } = params;
  await roomLockGateway.runLockedMany(
    hold.items.map((item) => item.roomId),
    (context) => holdRepository.deleteHold(context, hold)
  );
}
