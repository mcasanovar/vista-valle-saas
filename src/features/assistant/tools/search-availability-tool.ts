import "server-only";

import { z } from "zod";

import {
  AvailabilitySearchInputError,
  getAvailabilitySearchRepository,
  searchAvailability,
  SelectedRoomUnavailableError,
} from "@/features/availability";
import { getRoomReadSource } from "@/features/rooms";

import type { AssistantToolDefinition } from "../tool-registry";

const schema = z.object({
  checkIn: z.string(),
  checkOut: z.string(),
  guests: z.number().int().positive().optional(),
  room: z.string().optional(),
});

export type SearchAvailabilityToolInput = z.infer<typeof schema>;

export type SearchAvailabilityToolResult =
  | Readonly<{
      checkIn: string;
      checkOut: string;
      guests: number;
      rooms: readonly Readonly<{ id: string; name: string; slug: string }>[];
      success: true;
    }>
  | Readonly<{ code: "invalid_input" | "room_unavailable"; message: string; success: false }>;

/**
 * `buscar_disponibilidad` (task 5.1): wraps `searchAvailability` directly —
 * no separate logic. Never fabricates a result: an empty `rooms` array
 * from a real query is returned as-is (task 5.6), and a bad instruction
 * (unparseable dates, an unknown room) comes back as a typed `success:
 * false` result instead of throwing, so the model can relay it in text.
 */
export function createSearchAvailabilityTool(): AssistantToolDefinition<
  SearchAvailabilityToolInput,
  SearchAvailabilityToolResult
> {
  return Object.freeze({
    description:
      "Busca habitaciones disponibles para un rango de fechas, opcionalmente para una cantidad de huéspedes o una habitación específica.",
    async handler(input): Promise<SearchAvailabilityToolResult> {
      try {
        const result = await searchAvailability(input, {
          availabilityRepository: getAvailabilitySearchRepository(),
          roomSource: await getRoomReadSource(),
        });
        return Object.freeze({ ...result, success: true as const });
      } catch (error) {
        if (error instanceof AvailabilitySearchInputError) {
          return Object.freeze({
            code: "invalid_input" as const,
            message: error.message,
            success: false as const,
          });
        }
        if (error instanceof SelectedRoomUnavailableError) {
          return Object.freeze({
            code: "room_unavailable" as const,
            message: error.message,
            success: false as const,
          });
        }
        throw error;
      }
    },
    lane: "read",
    name: "buscar_disponibilidad",
    schema,
  });
}
