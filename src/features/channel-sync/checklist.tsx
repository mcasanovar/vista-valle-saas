"use client";
import { useState } from "react";
import type { ChannelSyncTask } from "./tasks";
export function ChannelSyncChecklist({
  tasks,
  complete,
}: Readonly<{
  tasks: readonly ChannelSyncTask[];
  complete: (data: FormData) => Promise<unknown>;
}>) {
  const [items, setItems] = useState(tasks);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  return (
    <section aria-labelledby="sync-title">
      <h1 id="sync-title">Sincronizaciones pendientes</h1>
      <p role="status">{message}</p>
      <ul>
        {items.map((task) => (
          <li key={task.id}>
            {task.reservationId} — {task.platform}
            <form
              action={async (data) => {
                if (!confirm("¿Marcar sincronización completada?")) return;
                setPending(true);
                try {
                  await complete(data);
                  setItems((current) =>
                    current.filter((x) => x.id !== task.id)
                  );
                  setMessage("Sincronización completada.");
                } catch {
                  setMessage("No pudimos completar la sincronización.");
                } finally {
                  setPending(false);
                }
              }}
            >
              <input type="hidden" name="id" value={task.id} />
              <button disabled={pending}>Completar {task.platform}</button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
