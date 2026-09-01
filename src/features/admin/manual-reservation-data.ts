import "server-only";

import { getRoomReadSource, type RoomReadSource } from "@/features/rooms";
import { requireAdministrator } from "@/infrastructure/auth/authorization";

export type ManualReservationInitialData = Readonly<{
  /** No dates exist yet, so availability must not be guessed or cached here. */
  availability: Readonly<{ status: "dates_required" }>;
  /** Safe selection metadata only; pricing remains server-derived on submit. */
  rooms: readonly Readonly<{
    capacity: number;
    id: string;
    name: string;
  }>[];
}>;

export function createManualReservationInitialData(
  roomSource: RoomReadSource
): ManualReservationInitialData {
  return Object.freeze({
    availability: Object.freeze({ status: "dates_required" as const }),
    rooms: Object.freeze(
      roomSource.listActive().map((room) =>
        Object.freeze({
          capacity: room.capacity,
          id: room.id,
          name: room.name,
        })
      )
    ),
  });
}

/**
 * Administrative server boundary for the manual reservation form's initial
 * data. There is deliberately no client input: room availability is queried
 * only after dates are supplied, and is always rechecked on confirmation.
 */
export async function getManualReservationInitialData(): Promise<ManualReservationInitialData> {
  await requireAdministrator();
  return createManualReservationInitialData(await getRoomReadSource());
}
