import "server-only";

import type { AnyAssistantToolDefinition } from "../../tool-registry";
import { createChangeReservationStatusTool } from "./change-reservation-status-tool";
import { createCollectPaymentTool } from "./collect-payment-tool";
import { createCreateBlockTool } from "./create-block-tool";
import { createCreateReservationTool } from "./create-reservation-tool";
import { createEditReservationDatesTool } from "./edit-reservation-dates-tool";
import { createRemoveBlockTool } from "./remove-block-tool";

export * from "./change-reservation-status-tool";
export * from "./collect-payment-tool";
export * from "./create-block-tool";
export * from "./create-reservation-tool";
export * from "./edit-reservation-dates-tool";
export * from "./remove-block-tool";

/** The write-lane tools (task 6.4-6.9): every handler only ever produces a proposal. */
export function createWriteAssistantTools(): readonly AnyAssistantToolDefinition[] {
  return Object.freeze([
    createCreateReservationTool(),
    createEditReservationDatesTool(),
    createChangeReservationStatusTool(),
    createCollectPaymentTool(),
    createCreateBlockTool(),
    createRemoveBlockTool(),
  ]);
}
