"use client";

import { useState } from "react";
import { Button, Heading, Textarea } from "@/presentation/atoms";

export type AssistantMemoryFactItem = Readonly<{
  fact: string;
  id: string;
}>;

export type AssistantMemoryViewProps = Readonly<{
  deleteFact: (id: string) => Promise<void>;
  facts: readonly AssistantMemoryFactItem[];
  updateFact: (id: string, fact: string) => Promise<unknown>;
}>;

/**
 * The memory view (task 10.3): every fact the administrator has taught
 * the assistant, editable and deletable here. A deleted fact stops
 * applying because it's simply absent the next time the prompt prefix is
 * built (prompt.ts reads whatever `listFacts` returns "now").
 */
export function AssistantMemoryView({
  deleteFact,
  facts,
  updateFact,
}: AssistantMemoryViewProps) {
  const [items, setItems] = useState(facts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  function startEditing(item: AssistantMemoryFactItem) {
    setEditingId(item.id);
    setDraft(item.fact);
  }

  async function saveEdit(id: string) {
    const value = draft.trim();
    if (!value) return;
    await updateFact(id, value);
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, fact: value } : item))
    );
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    await deleteFact(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }

  return (
    <section aria-label="Memoria del asistente" className="space-y-3">
      <Heading level={2}>Memoria</Heading>
      {items.length === 0 ? (
        <p className="font-sans text-sm text-muted-foreground">
          El asistente todavía no tiene hechos enseñados.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li className="flex items-start gap-2 rounded-md border p-3" key={item.id}>
              {editingId === item.id ? (
                <div className="flex flex-1 flex-col gap-2">
                  <Textarea
                    aria-label={`Editar hecho: ${item.fact}`}
                    onChange={(event) => setDraft(event.target.value)}
                    rows={2}
                    value={draft}
                  />
                  <div className="flex gap-2">
                    <Button onClick={() => void saveEdit(item.id)} size="default">
                      Guardar
                    </Button>
                    <Button
                      onClick={() => setEditingId(null)}
                      variant="secondary"
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="flex-1 font-sans text-sm text-foreground">
                    {item.fact}
                  </p>
                  <Button onClick={() => startEditing(item)} variant="secondary">
                    Editar
                  </Button>
                  <Button
                    onClick={() => void handleDelete(item.id)}
                    variant="destructive"
                  >
                    Borrar
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
