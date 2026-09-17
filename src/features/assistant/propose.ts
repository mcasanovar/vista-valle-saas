import "server-only";

import { getAssistantInteractionAudit } from "./interaction-audit";

export type ProposeAssistantOperationInput = Readonly<{
  actorUserId: string;
  instruction?: string;
  operation: string;
  payload: Readonly<Record<string, unknown>>;
}>;

export type AssistantProposalReceipt = Readonly<{
  expiresAt: string;
  token: string;
}>;

/**
 * Shared by every write-lane tool's handler (design.md decision 2): builds
 * and persists a proposal, returning only its token. This is the only
 * thing a `write` handler is able to do — there is no path from here to a
 * domain execution function. Executing happens later, in
 * `confirmAssistantProposalAction`, triggered by the administrator.
 */
export async function proposeAssistantOperation(
  input: ProposeAssistantOperationInput
): Promise<AssistantProposalReceipt> {
  const audit = getAssistantInteractionAudit();
  if (!audit) throw new Error("Assistant unavailable");
  const token = crypto.randomUUID();
  const entry = await audit.create({
    actor: input.actorUserId,
    instruction: input.instruction ?? input.operation,
    interpretation: { operation: input.operation, payload: input.payload },
    proposalToken: token,
  });
  return Object.freeze({
    expiresAt: entry.expiresAt.toISOString(),
    token,
  });
}
