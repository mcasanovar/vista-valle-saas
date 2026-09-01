import { CalendarAssistantChat } from "@/features/assistant/calendar-assistant-chat";
import {
  cancelBlockProposalAction,
  confirmBlockProposalAction,
  startBlockProposalAction,
} from "@/features/assistant/actions";

export default function AssistantPage() {
  return (
    <CalendarAssistantChat
      cancel={cancelBlockProposalAction}
      confirm={confirmBlockProposalAction}
      start={startBlockProposalAction}
    />
  );
}
