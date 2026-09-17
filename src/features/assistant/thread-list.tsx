"use client";

import { Button } from "@/presentation/atoms";

export type AssistantThreadListItem = Readonly<{
  id: string;
  title: string | null;
  updatedAt: Date | string;
}>;

export type AssistantThreadListProps = Readonly<{
  activeThreadId: string | null;
  onNewThread: () => void;
  onSelectThread: (threadId: string) => void;
  threads: readonly AssistantThreadListItem[];
}>;

/** The thread list (task 8.5): opening a new thread or resuming a previous one. */
export function AssistantThreadList({
  activeThreadId,
  onNewThread,
  onSelectThread,
  threads,
}: AssistantThreadListProps) {
  return (
    <nav aria-label="Hilos de conversación" className="space-y-3">
      <Button onClick={onNewThread} variant="secondary" className="w-full">
        Nuevo hilo
      </Button>
      <ul className="space-y-1">
        {threads.map((thread) => (
          <li key={thread.id}>
            <button
              type="button"
              onClick={() => onSelectThread(thread.id)}
              aria-current={thread.id === activeThreadId ? "true" : undefined}
              className={`min-h-11 w-full truncate rounded-md px-3 py-2 text-left font-sans text-sm transition-colors duration-200 ease-standard ${
                thread.id === activeThreadId
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {thread.title?.trim() || "Conversación sin título"}
            </button>
          </li>
        ))}
        {threads.length === 0 ? (
          <li className="px-3 py-2 font-sans text-sm text-muted-foreground">
            Todavía no hay hilos.
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
