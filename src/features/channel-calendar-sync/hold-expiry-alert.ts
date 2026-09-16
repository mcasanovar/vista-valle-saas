import "server-only";
import type { ReservationHoldRecord } from "@/features/reservations";
import { recordChannelSyncConflictAlert } from "./conflict-alerts";

/**
 * Only the lookup `raiseConflictAlertForExpiredHold` needs from
 * `HoldRepository<TContext>` (`getHoldById` takes no context/transaction),
 * so the helper stays non-generic instead of forcing every call site to
 * resolve a single `TContext` across the mock/production dependency bags.
 */
export type HoldLookup = Readonly<{
  getHoldById: (id: string) => Promise<ReservationHoldRecord | null>;
}>;

/**
 * Raises the shared channel-sync conflict alert for a `HoldExpiredError`
 * caught while confirming an online payment (see `channel-calendar-sync`
 * spec: "Alerta de conflicto por vencimiento de retención durante
 * sincronización") — any of the hold's rooms may have been taken by an
 * inbound channel-sync event during the expiry window, so one alert is
 * raised per room. A no-op if the hold row is no longer found (nothing to
 * attribute the alert to).
 */
export async function raiseConflictAlertForExpiredHold(
  holdId: string,
  holdRepository: HoldLookup
): Promise<void> {
  const hold = await holdRepository.getHoldById(holdId);
  if (!hold) return;
  for (const item of hold.items) {
    await recordChannelSyncConflictAlert({ roomId: item.roomId });
  }
}
