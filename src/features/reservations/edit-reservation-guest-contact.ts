import { parseGuestContactEditInput } from "./guest";
import type { GuestRecord, GuestRepository } from "./guest-repository";
import {
  ReservationNotFoundError,
  type ReservationRepository,
} from "./reservation-repository";

export type EditReservationGuestContactInput = Readonly<{
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  reservationId: string;
}>;

export type EditReservationGuestContactParams<TContext> = Readonly<{
  guestRepository: GuestRepository<TContext>;
  input: EditReservationGuestContactInput;
  reservationRepository: ReservationRepository<TContext>;
}>;

/**
 * Updates a reservation's guest contact info (name, last name, email,
 * phone), independent of the reservation's origin or status (design.md
 * decision 4 of "allow-full-reservation-editing-and-ota-sync-toggle").
 * Deliberately separate from `editReservationDates`: this edit never
 * touches dates, pricing, payments, or reservation status, so it needs no
 * room lock and no financial recalculation.
 */
export async function editReservationGuestContact<TContext>(
  params: EditReservationGuestContactParams<TContext>
): Promise<GuestRecord> {
  const { guestRepository, input, reservationRepository } = params;

  const contact = parseGuestContactEditInput({
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
  });

  const reservation = await reservationRepository.getReservationById(
    input.reservationId
  );
  if (!reservation) throw new ReservationNotFoundError(input.reservationId);

  return guestRepository.updateGuest(reservation.guestId, contact);
}
