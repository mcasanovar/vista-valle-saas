import type { RoomLockGateway } from "@/features/availability";

import type {
  ReservationRecord,
  ReservationRepository,
  ReservationStateTransition,
} from "./reservation-repository";
import { ReservationNotFoundError } from "./reservation-repository";

export type TransitionReservationStateParams<TContext> = Readonly<{
  actorUserId?: string;
  reservationId: string;
  reservationRepository: ReservationRepository<TContext>;
  roomLockGateway: RoomLockGateway<TContext>;
  to: ReservationStateTransition["to"];
}>;

/**
 * Serializes lifecycle changes on every reservation item room row. The repository
 * re-reads state inside that transaction, records an audit event in the
 * production adapter, and leaves payment state untouched.
 */
export async function transitionReservationState<TContext>(
  params: TransitionReservationStateParams<TContext>
): Promise<ReservationRecord> {
  const current = await params.reservationRepository.getReservationById(
    params.reservationId
  );
  if (!current) throw new ReservationNotFoundError(params.reservationId);

  return params.roomLockGateway.runLockedMany(
    current.items.map((item) => item.roomId),
    (context) =>
      params.reservationRepository.transitionReservationState(context, {
        actorUserId: params.actorUserId,
        reservationId: params.reservationId,
        to: params.to,
      })
  );
}
