import "server-only";

import { z } from "zod";

import {
  AvailabilitySearchInputError,
  getAvailabilitySearchRepository,
  searchAvailability,
  SelectedRoomUnavailableError,
} from "@/features/availability";
import { getRoomReadSource } from "@/features/rooms";
import { manualOrigins, type ManualReservationInput } from "@/features/admin";

import type { AssistantToolDefinition } from "../../tool-registry";
import { proposeAssistantOperation } from "../../propose";

const schema = z.object({
  checkIn: z.string(),
  checkOut: z.string(),
  guest: z.object({
    comment: z.string().optional(),
    company: z.string().optional(),
    email: z.string().email(),
    firstName: z.string().min(1),
    guestCount: z.number().int().positive(),
    lastName: z.string().min(1),
    phone: z.string().min(1),
    rut: z.string().optional(),
  }),
  invoice: z
    .object({
      businessActivity: z.string().min(1),
      email: z.string().email(),
      name: z.string().min(1),
      phone: z.string().min(1),
      rut: z.string().min(1),
    })
    .optional(),
  origin: z.enum(manualOrigins),
  rooms: z
    .array(
      z.object({ guestCount: z.number().int().positive(), roomId: z.string().min(1) })
    )
    .min(1),
});

export type CreateReservationToolInput = z.infer<typeof schema>;

export type CreateReservationToolResult =
  | Readonly<{ expiresAt: string; success: true; token: string }>
  | Readonly<{ code: "invalid_input" | "room_unavailable"; message: string; success: false }>;

/**
 * `crear_reserva` (task 6.4): a write-lane tool never executes — it
 * resolves the requested rooms against real data (so a made-up room id
 * fails here, not silently), does a best-effort availability check, and
 * only ever produces a proposal. `confirmAssistantProposalAction` does the
 * actual, re-validated creation via `createManualReservationFromInputResolved`
 * — the same core the manual-reservation form uses.
 */
export function createCreateReservationTool(): AssistantToolDefinition<
  CreateReservationToolInput,
  CreateReservationToolResult
> {
  return Object.freeze({
    description:
      "Propone crear una reserva manual. No la crea: genera una propuesta que el administrador debe confirmar.",
    lane: "write",
    async handler(input, context): Promise<CreateReservationToolResult> {
      const roomSource = await getRoomReadSource();
      const activeRooms = roomSource.listActive();

      for (const selection of input.rooms) {
        const room = activeRooms.find(
          (candidate) =>
            candidate.id === selection.roomId || candidate.slug === selection.roomId
        );
        if (!room) {
          return Object.freeze({
            code: "invalid_input" as const,
            message: `No encontramos una habitación llamada "${selection.roomId}".`,
            success: false as const,
          });
        }
        if (selection.guestCount > room.capacity) {
          return Object.freeze({
            code: "invalid_input" as const,
            message: `${room.name} admite hasta ${room.capacity} huéspedes.`,
            success: false as const,
          });
        }
      }

      for (const selection of input.rooms) {
        try {
          const availability = await searchAvailability(
            {
              checkIn: input.checkIn,
              checkOut: input.checkOut,
              guests: selection.guestCount,
              room: selection.roomId,
            },
            { availabilityRepository: getAvailabilitySearchRepository(), roomSource }
          );
          // `searchAvailability` filters an occupied room out of `rooms`
          // rather than throwing — it only throws for a room id/slug that
          // doesn't exist, which is already ruled out above.
          if (availability.rooms.length === 0) {
            return Object.freeze({
              code: "room_unavailable" as const,
              message: `La habitación "${selection.roomId}" no está disponible para esas fechas.`,
              success: false as const,
            });
          }
        } catch (error) {
          if (error instanceof SelectedRoomUnavailableError) {
            return Object.freeze({
              code: "room_unavailable" as const,
              message: `No encontramos la habitación "${selection.roomId}".`,
              success: false as const,
            });
          }
          if (error instanceof AvailabilitySearchInputError) {
            return Object.freeze({
              code: "invalid_input" as const,
              message: error.message,
              success: false as const,
            });
          }
          throw error;
        }
      }

      const payload: ManualReservationInput = {
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        guest: input.guest,
        invoice: input.invoice,
        origin: input.origin,
        rooms: input.rooms,
      };
      const receipt = await proposeAssistantOperation({
        actorUserId: context.actorUserId,
        operation: "crear_reserva",
        payload,
      });
      return Object.freeze({ ...receipt, success: true as const });
    },
    name: "crear_reserva",
    schema,
  });
}
