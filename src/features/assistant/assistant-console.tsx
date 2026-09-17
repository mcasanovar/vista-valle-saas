"use client";

import { useState } from "react";
import { Button, Feedback, Heading, LoadingState, Textarea } from "@/presentation/atoms";
import { ChatMessageBubble } from "@/presentation/molecules";

import { AssistantProposalCard } from "./proposal-card";
import { AssistantThreadList, type AssistantThreadListItem } from "./thread-list";
import { getAssistantThreadAction } from "./thread-actions";
import { VoiceInputButton } from "./voice-input-button";

export type AssistantChatMessage = Readonly<{
  content: string;
  id: string;
  role: "assistant" | "user";
}>;

export type AssistantConsoleProposal = Readonly<{
  messageId: string;
  operation: string;
  payload: Readonly<Record<string, unknown>>;
  token: string;
}>;

export type AssistantConsoleProps = Readonly<{
  cancelProposal: (token: string) => Promise<void>;
  confirmProposal: (
    token: string
  ) => Promise<Readonly<{ data?: Readonly<Record<string, unknown>>; message?: string; ok: boolean }>>;
  initialThreads: readonly AssistantThreadListItem[];
}>;

async function readStreamedProposals(response: Response) {
  const header = response.headers.get("X-Assistant-Proposals");
  if (!header) return [];
  try {
    const decoded = atob(header);
    return JSON.parse(decoded) as readonly Readonly<{
      operation: string;
      payload: Readonly<Record<string, unknown>>;
      token: string;
    }>[];
  } catch {
    return [];
  }
}

/**
 * The conversation page's client orchestrator (task 8.3): text input,
 * message history, thread switching, and proposal cards. Everything that
 * touches the server — sending an instruction, loading a thread,
 * confirming or cancelling a proposal — is a prop, so this file never
 * imports a feature module directly, keeping it swappable and testable.
 */
export function AssistantConsole({
  cancelProposal,
  confirmProposal,
  initialThreads,
}: AssistantConsoleProps) {
  const [threads, setThreads] = useState(initialThreads);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<readonly AssistantChatMessage[]>([]);
  const [proposals, setProposals] = useState<readonly AssistantConsoleProposal[]>([]);
  const [instruction, setInstruction] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSelectThread(threadId: string) {
    setLoadingThread(true);
    setError(null);
    try {
      const thread = await getAssistantThreadAction(threadId);
      if (!thread) {
        setError("No encontramos ese hilo.");
        return;
      }
      setActiveThreadId(thread.id);
      setMessages(
        thread.messages.map((message) => ({
          content: message.content,
          id: message.id,
          role: message.role,
        }))
      );
      setProposals([]);
    } finally {
      setLoadingThread(false);
    }
  }

  function handleNewThread() {
    setActiveThreadId(null);
    setMessages([]);
    setProposals([]);
    setError(null);
  }

  async function handleSend(overrideText?: string) {
    const value = (overrideText ?? instruction).trim();
    if (!value || sending) return;
    setSending(true);
    setError(null);
    const userMessage: AssistantChatMessage = {
      content: value,
      id: crypto.randomUUID(),
      role: "user",
    };
    setMessages((current) => [...current, userMessage]);
    setInstruction("");

    try {
      const response = await fetch("/api/admin/assistant", {
        body: JSON.stringify({
          instruction: value,
          threadId: activeThreadId ?? undefined,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "No pudimos completar la instrucción.");
        return;
      }

      const text = await response.text();
      const threadId = response.headers.get("X-Assistant-Thread-Id");
      const receivedProposals = await readStreamedProposals(response);

      const assistantMessage: AssistantChatMessage = {
        content: text,
        id: crypto.randomUUID(),
        role: "assistant",
      };
      setMessages((current) => [...current, assistantMessage]);
      setProposals((current) => [
        ...current,
        ...receivedProposals.map((proposal) => ({
          messageId: assistantMessage.id,
          operation: proposal.operation,
          payload: proposal.payload,
          token: proposal.token,
        })),
      ]);

      if (threadId && threadId !== activeThreadId) {
        setActiveThreadId(threadId);
        setThreads((current) =>
          current.some((thread) => thread.id === threadId)
            ? current
            : [
                {
                  id: threadId,
                  title: value.slice(0, 80),
                  updatedAt: new Date(),
                },
                ...current,
              ]
        );
      }
    } catch {
      setError("No pudimos conectar con el asistente. Intenta nuevamente.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <AssistantThreadList
        activeThreadId={activeThreadId}
        onNewThread={handleNewThread}
        onSelectThread={handleSelectThread}
        threads={threads}
      />
      <div className="flex min-h-[60vh] flex-col gap-4">
        <Heading level={1}>Asistente</Heading>
        {error ? (
          <Feedback title="No pudimos continuar" variant="error">
            {error}
          </Feedback>
        ) : null}
        <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border p-4">
          {loadingThread ? <LoadingState label="Cargando hilo…" /> : null}
          {messages.map((message) => (
            <div key={message.id} className="space-y-3">
              <ChatMessageBubble
                author={message.role === "user" ? "Tú" : "Asistente"}
                role={message.role}
              >
                {message.content}
              </ChatMessageBubble>
              {proposals
                .filter((proposal) => proposal.messageId === message.id)
                .map((proposal) => (
                  <AssistantProposalCard
                    cancel={cancelProposal}
                    confirm={confirmProposal}
                    key={proposal.token}
                    onResolved={() => {
                      // The card renders its own confirmed/cancelled/failed
                      // state — removing it here on a failure would unmount
                      // it before the administrator ever sees why.
                    }}
                    operation={proposal.operation}
                    payload={proposal.payload}
                    token={proposal.token}
                  />
                ))}
            </div>
          ))}
          {messages.length === 0 && !loadingThread ? (
            <p className="font-sans text-sm text-muted-foreground">
              Escribe una instrucción para empezar, como &ldquo;busca
              disponibilidad para el próximo fin de semana&rdquo;.
            </p>
          ) : null}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend();
          }}
        >
          <Textarea
            aria-label="Instrucción para el asistente"
            className="min-h-11"
            disabled={sending}
            onChange={(event) => setInstruction(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Escribe una instrucción…"
            rows={2}
            value={instruction}
          />
          <VoiceInputButton
            disabled={sending}
            onError={setError}
            onTranscribed={(text) => {
              // Sends as soon as dictation stops — the administrator no
              // longer gets a chance to edit a mis-transcribed word before
              // it reaches the assistant. Any write it proposes still
              // needs explicit confirmation, so this only trades "review
              // the wording" for speed, not the domain-mutation safety net.
              setInstruction(text);
              void handleSend(text);
            }}
          />
          <Button disabled={sending || !instruction.trim()} loading={sending} type="submit">
            Enviar
          </Button>
        </form>
      </div>
    </section>
  );
}
