"use server";
import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { getPayAtPropertyCollectionService } from "./pay-at-property-collection";
export async function collectPayAtPropertyAction(data: FormData) {
  const user = await requireAdministrator();
  const service = getPayAtPropertyCollectionService();
  if (!service) throw new Error("Payments unavailable");
  return service.collect(
    {
      reservationId: String(data.get("reservationId") ?? ""),
      amountClp: Number(data.get("amountClp")),
      collectedOn: String(data.get("collectedOn") ?? ""),
      medium: String(data.get("medium") ?? ""),
    },
    user.user.id
  );
}
