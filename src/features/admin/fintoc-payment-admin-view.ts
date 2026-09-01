import "server-only";

import { createCanonicalMockFintocPaymentRepository } from "@/features/payments";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDrizzleFintocPaymentRepository } from "@/infrastructure/database/fintoc-payment-repository";

function getFintocPaymentRepository() {
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    return createCanonicalMockFintocPaymentRepository();
  }
  return createDrizzleFintocPaymentRepository(
    createProductionDatabase(boundary)
  );
}

/** Read model for the admin reservation detail page (see `app/(admin-protected)/admin/reservas/[id]/page.tsx`). */
export async function getFintocPaymentAdminViewByReservationId(
  reservationId: string
) {
  const repository = getFintocPaymentRepository();
  return repository.getPaymentByReservationId(reservationId);
}
