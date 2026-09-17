import { describe, expect, it } from "vitest";

import { getAssistantInteractionAudit } from "@/features/assistant/interaction-audit";

async function createInteraction(token: string) {
  const audit = getAssistantInteractionAudit();
  if (!audit) throw new Error("Mock audit is required for this test");
  return {
    audit,
    entry: await audit.create({
      actor: "admin-audit",
      instruction: "Bloquea la habitación para mantenimiento",
      interpretation: {
        operation: "crear_bloqueo",
        payload: {
          roomId: "demo-room-valle",
          checkIn: "2047-01-01",
          checkOut: "2047-01-03",
          reason: "Mantenimiento programado",
        },
      },
      corrections: ["Aclaración: usar fechas absolutas"],
      proposalToken: token,
    }),
  };
}

describe("assistant interaction audit", () => {
  it("persists the instruction, structured preview, correction, actor and execution result", async () => {
    const token = "private-proposal-token-audit-success";
    const { audit, entry } = await createInteraction(token);

    expect(entry).toMatchObject({
      actor: "admin-audit",
      instruction: "Bloquea la habitación para mantenimiento",
      interpretation: {
        operation: "crear_bloqueo",
        payload: { roomId: "demo-room-valle" },
      },
      corrections: ["Aclaración: usar fechas absolutas"],
      status: "previewed",
    });
    expect(entry.createdAt).toBeInstanceOf(Date);
    expect(entry).not.toHaveProperty("proposalToken");

    await audit.approve(token, "admin-audit");
    const executed = await audit.recordExecutionResult(token, "admin-audit", {
      outcome: "executed",
      data: { blockId: "block-audit-success" },
    });
    expect(executed).toMatchObject({
      status: "executed",
      result: { outcome: "executed", data: { blockId: "block-audit-success" } },
    });
    expect(executed.approvedAt).toBeInstanceOf(Date);
    expect(executed.executedAt).toBeInstanceOf(Date);
  });

  it("records cancellation and a safe conflict result without exposing tokens or secrets", async () => {
    const cancelled = await createInteraction(
      "private-proposal-token-audit-cancel"
    );
    const cancelledEntry = await cancelled.audit.cancel(
      "private-proposal-token-audit-cancel",
      "admin-audit"
    );
    expect(cancelledEntry).toMatchObject({
      status: "cancelled",
      result: { outcome: "cancelled" },
    });

    const failed = await createInteraction(
      "private-proposal-token-audit-failure"
    );
    await failed.audit.approve(
      "private-proposal-token-audit-failure",
      "admin-audit"
    );
    const failure = await failed.audit.recordExecutionResult(
      "private-proposal-token-audit-failure",
      "admin-audit",
      { outcome: "failed", code: "unavailable_or_conflict" }
    );
    expect(failure).toMatchObject({
      status: "failed",
      result: { outcome: "failed", code: "unavailable_or_conflict" },
    });

    expect(JSON.stringify(await failed.audit.list())).not.toContain(
      "private-proposal-token"
    );
    expect(JSON.stringify(await failed.audit.list())).not.toContain("secret");
  });
});
