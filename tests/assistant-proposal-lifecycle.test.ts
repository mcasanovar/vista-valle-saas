import { describe, expect, it } from "vitest";

import {
  AssistantProposalAlreadyResolvedError,
  AssistantProposalExpiredError,
  AssistantProposalNotFoundError,
  getAssistantInteractionAudit,
} from "@/features/assistant/interaction-audit";

function audit() {
  const instance = getAssistantInteractionAudit();
  if (!instance) throw new Error("Mock audit is required for this test");
  return instance;
}

const interpretation = Object.freeze({
  operation: "crear_bloqueo",
  payload: Object.freeze({ roomId: "demo-room-valle" }),
});

describe("assistant proposal lifecycle (generalized proposal-tokens, task 6.1)", () => {
  it("rejects confirming an expired proposal, and leaves it unusable afterwards", async () => {
    const store = audit();
    const token = "lifecycle-expired";
    await store.create({
      actor: "admin-1",
      instruction: "x",
      interpretation,
      proposalToken: token,
      ttlMinutes: -1,
    });

    await expect(store.approve(token, "admin-1")).rejects.toBeInstanceOf(
      AssistantProposalExpiredError
    );
    // Still unusable on a second attempt — it doesn't reset to pending.
    await expect(store.approve(token, "admin-1")).rejects.toBeInstanceOf(
      AssistantProposalExpiredError
    );
  });

  it("consumes a proposal only once: a second confirm attempt fails", async () => {
    const store = audit();
    const token = "lifecycle-single-use";
    await store.create({
      actor: "admin-1",
      instruction: "x",
      interpretation,
      proposalToken: token,
    });

    await store.approve(token, "admin-1");
    await expect(store.approve(token, "admin-1")).rejects.toBeInstanceOf(
      AssistantProposalAlreadyResolvedError
    );
  });

  it("belongs only to the actor who created it", async () => {
    const store = audit();
    const token = "lifecycle-actor-owned";
    await store.create({
      actor: "admin-1",
      instruction: "x",
      interpretation,
      proposalToken: token,
    });

    await expect(store.approve(token, "admin-2")).rejects.toBeInstanceOf(
      AssistantProposalNotFoundError
    );
    // The rightful actor can still confirm it — it wasn't consumed by the
    // other administrator's failed attempt.
    await expect(store.approve(token, "admin-1")).resolves.toMatchObject({
      status: "approved",
    });
  });

  it("rejects an unknown token", async () => {
    const store = audit();
    await expect(store.approve("does-not-exist", "admin-1")).rejects.toBeInstanceOf(
      AssistantProposalNotFoundError
    );
  });

  it("cancelling leaves the token unusable without recording an execution result", async () => {
    const store = audit();
    const token = "lifecycle-cancel-then-confirm";
    await store.create({
      actor: "admin-1",
      instruction: "x",
      interpretation,
      proposalToken: token,
    });

    const cancelled = await store.cancel(token, "admin-1");
    expect(cancelled.status).toBe("cancelled");
    await expect(store.approve(token, "admin-1")).rejects.toBeInstanceOf(
      AssistantProposalAlreadyResolvedError
    );
  });
});
