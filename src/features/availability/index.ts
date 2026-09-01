// Public API boundary for the availability capability. Exports are added with its implementation.
export * from "./date-only";
export * from "./occupancy";
export * from "./occupancy-source";
export * from "./room-lock";
export * from "./search";
export { AvailabilitySearchController } from "./search-controller";
export {
  serializeAvailabilityResultsQuery,
  validateAvailabilityResultsQuery,
  type AvailabilityResultsQuery,
  type AvailabilityResultsQueryError,
  type AvailabilityResultsQueryErrorCode,
  type AvailabilityResultsQueryField,
  type AvailabilityResultsQueryValidation,
  type AvailabilityResultsSearchParams,
} from "./results-query";
export { composeAvailabilityResults } from "./results-service";
export { getAvailabilitySearchRepository } from "./search-source";
