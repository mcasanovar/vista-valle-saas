import "server-only";

import type { AnyAssistantToolDefinition } from "../tool-registry";
import { createFinancialSummaryTool } from "./financial-summary-tool";
import { createListReservationsTool } from "./list-reservations-tool";
import { createListRoomBlocksTool } from "./list-room-blocks-tool";
import { createRecordMemoryFactTool } from "./record-memory-fact-tool";
import { createSearchAvailabilityTool } from "./search-availability-tool";
import { createViewReservationTool } from "./view-reservation-tool";
import { createWriteAssistantTools } from "./write";

export * from "./financial-summary-tool";
export * from "./list-reservations-tool";
export * from "./list-room-blocks-tool";
export * from "./record-memory-fact-tool";
export * from "./search-availability-tool";
export * from "./view-reservation-tool";
export * from "./write";

/** The read-lane tools (task 5.*), wired to their production dependencies. */
export function createReadAssistantTools(): readonly AnyAssistantToolDefinition[] {
  return Object.freeze([
    createSearchAvailabilityTool(),
    createListReservationsTool(),
    createViewReservationTool(),
    createFinancialSummaryTool(),
    createListRoomBlocksTool(),
  ]);
}

/** Every tool the assistant can call: read-lane, write-lane, then the memory-lane tool (task 4.1's registry keys off `lane`, not this order). */
export function createAllAssistantTools(): readonly AnyAssistantToolDefinition[] {
  return Object.freeze([
    ...createReadAssistantTools(),
    ...createWriteAssistantTools(),
    createRecordMemoryFactTool(),
  ]);
}
