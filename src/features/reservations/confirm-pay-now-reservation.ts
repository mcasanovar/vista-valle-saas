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
  paymentExternalReference: string;
  paymentId: string;
  providerPaymentId: string;
  reservationRepository: ReservationRepository<TContext>;
  roomLockGateway: RoomLockGateway<TContext>;
}>;

/**
 * Converts an unexpired hold into a `CONFIRMED`/`pay_now` reservation once
 * its Fintoc payment has succeeded (design.md decision 7 of
 * `build-vista-valle-booking-mvp`: "confirmar en una nueva transacción
 * cuando se agregue ese proveedor"). Runs under `RoomLockGateway.runLocked`
 * rather than `runExclusive`: the hold already reserved this exact
 * interval, so there is nothing left to re-validate, only state to change
 * (see `RoomLockGateway`'s doc comment on `runLocked`).
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
    paymentExternalReference,
    paymentId,
    providerPaymentId,
    reservationRepository,
    roomLockGateway,
  } = params;

  if (isHoldExpired(hold, now)) {
    throw new HoldExpiredError(hold.id);
  }

  return roomLockGateway.runLocked(hold.roomId, async (context) => {
    const created = await reservationRepository.createConfirmedPayNowReservation(
      context,
      {
        checkIn: hold.checkIn,
        checkOut: hold.checkOut,
        guestCount: hold.guestCount,
        guestId: hold.guestId,
        item: {
          chargesClp: hold.chargesClp,
          guestCount: hold.guestCount,
          nightlyPriceClp: hold.nightlyPriceClp,
          nights: nights(hold.checkIn, hold.checkOut),
          roomId: hold.roomId,
          totalClp: hold.totalClp,
        },
        paymentExternalReference,
        paymentId,
        providerPaymentId,
        publicId: generatePublicId(),
      }
    );
    await holdRepository.deleteHold(context, hold);
    return created;
  });
}

/** Frees the room immediately once a hold's Fintoc payment definitively fails, instead of waiting for `expiresAt`. */
export async function releaseFailedPayNowHold<TContext>(
  params: Readonly<{
    hold: ReservationHoldRecord;
    holdRepository: HoldRepository<TContext>;
    roomLockGateway: RoomLockGateway<TContext>;
  }>
): Promise<void> {
  const { hold, holdRepository, roomLockGateway } = params;
  await roomLockGateway.runLocked(hold.roomId, (context) =>
    holdRepository.deleteHold(context, hold)
  );
}
