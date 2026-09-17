import { redirect } from "next/navigation";

import { getServerEnvironment } from "@/config/server";
import { AssistantConsole } from "@/features/assistant/assistant-console";
import {
  cancelAssistantProposalAction,
  confirmAssistantProposalAction,
} from "@/features/assistant/confirm-actions";
import { listAssistantThreadsAction } from "@/features/assistant/thread-actions";
import { AssistantMemoryView } from "@/features/assistant/memory-view";
import {
  deleteAssistantMemoryFactAction,
  listAssistantMemoryFactsAction,
  updateAssistantMemoryFactAction,
} from "@/features/assistant/memory-actions";

export const dynamic = "force-dynamic";

/**
 * The assistant page (task 8.1). Behind `ASSISTANT_ENABLED` (design.md
 * decision 11): off, it behaves exactly as it did before this change —
 * a redirect to `/admin`, nothing else changes.
 */
export default async function AssistantPage() {
  if (!getServerEnvironment().ASSISTANT_ENABLED) {
    redirect("/admin");
  }

  const [threads, memoryFacts] = await Promise.all([
    listAssistantThreadsAction(),
    listAssistantMemoryFactsAction(),
  ]);

  return (
    <div className="space-y-8">
      <AssistantConsole
        cancelProposal={cancelAssistantProposalAction}
        confirmProposal={confirmAssistantProposalAction}
        initialThreads={threads}
      />
      <AssistantMemoryView
        deleteFact={deleteAssistantMemoryFactAction}
        facts={memoryFacts}
        updateFact={updateAssistantMemoryFactAction}
      />
    </div>
  );
}
