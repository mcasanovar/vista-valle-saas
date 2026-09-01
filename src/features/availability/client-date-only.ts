/**
 * Browser-safe lodging-date contract.
 *
 * Keep client components on this narrow import path instead of the availability
 * barrel: that barrel also exposes server-only repository composition.
 */
export {
  addLodgingDays,
  compareLodgingDates,
  isValidLodgingDate,
  lodgingToday,
  LODGING_TIME_ZONE,
  nights,
  parseLodgingDate,
  publicAvailabilityDateMinimums,
  type LodgingDate,
} from "./date-only";
