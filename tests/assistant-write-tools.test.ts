import { describe, expect, it } from "vitest";

import { createAssistantToolRegistry } from "@/features/assistant/tool-registry";
import type { AssistantToolInvocationContext } from "@/features/assistant/tool-registry";
import { createCreateReservationTool } from "@/features/assistant/tools/write/create-reservation-tool";
import { createChangeReservationStatusTool } from "@/features/assistant/tools/write/change-reservation-status-tool";
import { createCreateBlockTool } from "@/features/assistant/tools/write/create-block-tool";
import { createRemoveBlockTool } from "@/features/assistant/tools/write/remove-block-tool";
import type { ViewReservationReader } from "@/features/assistant/tools/view-reservation-tool";
import { confirmAssistantProposalAction } from "@/features/assistant/confirm-actions";
import { AssistantToolLaneMismatchError } from "@/features/assistant/tool-registry";
import { confirmPayAtPropertyBooking } from "@/features/reservations/confirm-pay-at-property";
import { listRoomBlocks } from "@/features/room-blocks";

import { beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdministrator: vi.fn() }));
vi.mock("@/infrastructure/auth/authorization", () => ({
  requireAdministrator: mocks.requireAdministrator,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const actorUserId = "admin-write-tools";
const context: AssistantToolInvocationContext = Object.freeze({
  actorUserId,
  operationalContext: Object.freeze({
    rooms: [],
    today: "2030-01-01",
    validManualOrigins: [],
    validReservationStatusTransitions: [],
    validRoomBlockStatuses: [],
  }),
});

beforeEach(() => {
  mocks.requireAdministrator.mockResolvedValue({ user: { id: actorUserId } });
});

describe("crear_reserva tool (task 6.4)", () => {
  it("rejects insufficient data before ever proposing anything", async () => {
    const tool = createCreateReservationTool();
    const registry = createAssistantToolRegistry([tool]);

    await expect(
      registry.invokeWriteTool(
        "crear_reserva",
        { checkIn: "2050-01-01", checkOut: "2050-01-03" },
        context
      )
    ).rejects.toThrow();
  });

  it("rejects an unknown room at the proposal step, before anything is persisted", async () => {
    const tool = createCreateReservationTool();

    const result = await tool.handler(
      {
        checkIn: "2050-02-01",
        checkOut: "2050-02-03",
        guest: {
          email: "nueva@example.com",
          firstName: "Nueva",
          guestCount: 1,
          lastName: "Reserva",
          phone: "+56944444444",
        },
        origin: "phone",
        rooms: [{ guestCount: 1, roomId: "does-not-exist-room" }],
      },
      context
    );

    expect(result).toMatchObject({ success: false, code: "invalid_input" });
  });

  it("does not execute a proposal for a room that became unavailable before confirmation", async () => {
    const tool = createCreateReservationTool();
    const checkIn = "2050-02-01";
    const checkOut = "2050-02-03";

    const proposed = await tool.handler(
      {
        checkIn,
        checkOut,
        guest: {
          email: "nueva@example.com",
          firstName: "Nueva",
          guestCount: 1,
          lastName: "Reserva",
          phone: "+56944444444",
        },
        origin: "phone",
        rooms: [{ guestCount: 1, roomId: "demo-room-terra" }],
      },
      context
    );
    expect(proposed.success).toBe(true);
    if (!proposed.success) return;
    const { token } = proposed;

    // Someone else books the room after the proposal, before it's confirmed.
    await confirmPayAtPropertyBooking({
      room: "demo-room-terra",
      checkIn,
      checkOut,
      firstName: "Otro",
      lastName: "Huésped",
      email: "otro-crea-reserva@example.com",
      phone: "+56933333333",
      guestCount: 1,
    });

    const result = await confirmAssistantProposalAction(token);
    expect(result.ok).toBe(false);
  });
});

describe("cambiar_estado tool payment info (task 6.7)", () => {
  it("exposes the current payment status and amount on a cancellation proposal", async () => {
    const reader: ViewReservationReader = {
      async get() {
        return {
          auditEvents: [],
          channelSyncTasks: [],
          checkIn: "2030-01-01",
          checkOut: "2030-01-03",
          createdAt: new Date(),
          externalPlatform: null,
          guest: {
            company: null,
            email: "x@example.com",
            firstName: "X",
            lastName: "Y",
            phone: "1",
            rut: null,
          },
          guestComment: null,
          id: "r-1",
          items: [],
          origin: "website",
          payments: [
            {
              amountClp: 120_000,
              createdAt: new Date(),
              id: "payment-1",
              paymentMethod: null,
              providerPaymentId: null,
              provider: "fintoc",
              receivedAt: new Date(),
              refundedAmountClp: 0,
              status: "approved",
            },
          ],
          publicId: "VV-1",
          status: "confirmed",
          totalClp: 120_000,
        };
      },
    };
    const tool = createChangeReservationStatusTool(reader);

    const result = await tool.handler({ reservationId: "r-1", to: "cancelled" }, context);

    expect(result).toMatchObject({
      success: true,
      paymentInfo: [{ amountClp: 120_000, status: "approved" }],
    });
  });

  it("does not look up payment info for completed or no-show transitions", async () => {
    let called = false;
    const reader: ViewReservationReader = {
      async get() {
        called = true;
        return null;
      },
    };
    const tool = createChangeReservationStatusTool(reader);

    const result = await tool.handler({ reservationId: "r-1", to: "completed" }, context);

    expect(called).toBe(false);
    expect(result).toMatchObject({ success: true, paymentInfo: undefined });
  });
});

describe("crear_bloqueo / eliminar_bloqueo tools (task 6.9)", () => {
  it("does not create a block that conflicts with an existing reservation", async () => {
    const checkIn = "2050-03-01";
    const checkOut = "2050-03-03";
    await confirmPayAtPropertyBooking({
      room: "demo-room-andes",
      checkIn,
      checkOut,
      firstName: "Ocupante",
      lastName: "Reserva",
      email: "ocupante@example.com",
      phone: "+56955555555",
      guestCount: 1,
    });

    const tool = createCreateBlockTool();
    const { token } = await tool.handler(
      { checkIn, checkOut, reason: "Mantenimiento", roomIds: ["demo-room-andes"] },
      context
    );

    const result = await confirmAssistantProposalAction(token);
    expect(result.ok).toBe(false);
  });

  it("removing a block frees the room's availability again", async () => {
    const checkIn = "2050-04-01";
    const checkOut = "2050-04-03";
    const createTool = createCreateBlockTool();
    const { token: createToken } = await createTool.handler(
      { checkIn, checkOut, reason: "Mantenimiento", roomIds: ["demo-room-valle"] },
      context
    );
    const created = await confirmAssistantProposalAction(createToken);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const blockId = (created.data.blockIds as readonly string[])[0]!;

    const activeBefore = await listRoomBlocks({ roomId: "demo-room-valle", status: "active" });
    expect(activeBefore.items.some((block) => block.id === blockId)).toBe(true);

    const removeTool = createRemoveBlockTool();
    const { token: removeToken } = await removeTool.handler({ blockId }, context);
    const removed = await confirmAssistantProposalAction(removeToken);
    expect(removed.ok).toBe(true);

    const activeAfter = await listRoomBlocks({ roomId: "demo-room-valle", status: "active" });
    expect(activeAfter.items.some((block) => block.id === blockId)).toBe(false);
    const removedAfter = await listRoomBlocks({ roomId: "demo-room-valle", status: "removed" });
    expect(removedAfter.items.some((block) => block.id === blockId)).toBe(true);
  });
});

describe("write-lane tools are not invocable from the read path (task 6.10)", () => {
  it("refuses to run crear_reserva through invokeReadTool", async () => {
    const tool = createCreateReservationTool();
    const registry = createAssistantToolRegistry([tool]);

    await expect(
      registry.invokeReadTool(
        "crear_reserva",
        {
          checkIn: "2050-01-01",
          checkOut: "2050-01-03",
          guest: {
            email: "a@example.com",
            firstName: "A",
            guestCount: 1,
            lastName: "B",
            phone: "1",
          },
          origin: "phone",
          rooms: [{ guestCount: 1, roomId: "demo-room-valle" }],
        },
        context
      )
    ).rejects.toBeInstanceOf(AssistantToolLaneMismatchError);
  });
});
