"use server";
import { revalidatePath } from "next/cache";

import { parseRoomSelectionParam } from "@/features/reservations";
import { requireAdministrator } from "@/infrastructure/auth/authorization";
import {
  editAdminReservationStayWithResult,
  type EditReservationStayActionResult,
} from "./edit-reservation-stay-core";

export type {
  EditReservationStayActionResult,
  EditReservationStayFinancialSummary,
} from "./edit-reservation-stay-core";

/**
 * Thin `FormData` adapter over `editAdminReservationStayWithResult`.
 *
 * Reads exactly four fields - `id`, `checkIn`, `checkOut`, and the
 * `rooms` selection - and nothing else. Any price, capacity, subtotal or
 * total present in the submission is ignored by construction: the rates
 * and the totals are resolved server-side from the rooms' current data.
 */
export async function editAdminReservationStayAction(
  formData: FormData
): Promise<EditReservationStayActionResult> {
  const session = await requireAdministrator();
  const id = String(formData.get("id") ?? "");
  const checkIn = String(formData.get("checkIn") ?? "");
  const checkOut = String(formData.get("checkOut") ?? "");
  const rawRooms = formData.get("rooms");

  const result = await editAdminReservationStayWithResult({
    actorUserId: session.user.id,
    ...(checkIn || checkOut ? { checkIn, checkOut } : {}),
    // An absent `rooms` field keeps the persisted rooms; a present one is
    // the complete requested set, even when it parses to nothing.
    ...(rawRooms === null
      ? {}
      : {
          items: parseRoomSelectionParam(String(rawRooms)).map((entry) => ({
            guestCount: entry.guestCount,
            roomId: entry.roomId,
          })),
        }),
    reservationId: id,
  });

  if (result.ok) {
    revalidatePath("/admin/reservas");
    revalidatePath(`/admin/reservas/${id}`);
    revalidatePath("/admin/calendario");
  }

  return result;
}
