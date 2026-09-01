import "server-only";
import { getServerEnvironment } from "@/config/server";
import { getManualRoomBlocks } from "@/features/room-blocks";
export type BlockProposalToken = Readonly<{
  token: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  reason: string;
  actor: string;
  expiresAt: Date;
}>;
const blockProposalTokensKey = Symbol.for(
  "vista-valle.mock.block-proposal-tokens"
);

function getTokens() {
  const scope = globalThis as typeof globalThis & {
    [key: symbol]: Map<string, BlockProposalToken> | undefined;
  };
  return (scope[blockProposalTokensKey] ??= new Map<
    string,
    BlockProposalToken
  >());
}

export function createBlockProposalToken(
  input: Omit<BlockProposalToken, "token" | "expiresAt">,
  ttlMs = 300000
) {
  if (getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT !== "mock")
    throw new Error("Proposal unavailable");
  const proposal = Object.freeze({
    ...input,
    token: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  getTokens().set(proposal.token, proposal);
  return proposal;
}
export async function executeBlockProposalToken(token: string, actor: string) {
  const tokens = getTokens();
  const proposal = tokens.get(token);
  if (!proposal || proposal.actor !== actor || proposal.expiresAt <= new Date())
    throw new Error("Proposal unavailable");
  tokens.delete(token);
  const service = getManualRoomBlocks();
  if (!service) throw new Error("Proposal unavailable");
  return service.create(proposal, actor);
}
export function cancelBlockProposalToken(token: string, actor: string) {
  const tokens = getTokens();
  const proposal = tokens.get(token);
  if (!proposal || proposal.actor !== actor)
    throw new Error("Proposal unavailable");
  tokens.delete(token);
}
