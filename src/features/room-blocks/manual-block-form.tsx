"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
// eslint-disable-next-line architecture/feature-public-api -- client-safe boundary avoids server-only availability barrel.
import { nights } from "@/features/availability/client-date-only";
import { Button } from "@/presentation/atoms";
import type { RoomBlockListItem } from "./manual-blocks";
type Room = Readonly<{ id: string; name: string }>;
const controlClass =
  "min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground";
export function ManualBlockForm({
  blocks,
  rooms,
  create,
  confirm,
  review,
  remove,
  initialSelection,
  filters,
  page = 1,
  pageSize = 20,
  total = 0,
}: Readonly<{
  blocks: readonly RoomBlockListItem[];
  rooms: readonly Room[];
  create: (data: FormData) => Promise<{ ok: boolean; message?: string; roomIds?: readonly string[] }>;
  confirm?: (data: FormData) => Promise<{ ok: boolean; message?: string; roomIds?: readonly string[] }>;
  review?: (data: FormData) => Promise<{ kind: "clear" | "conflicts" | "failure"; conflicts?: readonly { date: string; roomName: string; source: string }[]; message?: string }>;
  remove: (data: FormData) => Promise<unknown>;
  initialSelection?: Readonly<{
    roomId?: string;
    checkIn?: string;
    checkOut?: string;
  }>;
  filters?: Readonly<{
    roomId?: string;
    checkIn?: string;
    checkOut?: string;
    reason?: string;
    status: string;
  }>;
  page?: number;
  pageSize?: number;
  total?: number;
}>) {
  const router = useRouter();
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState<string>(),
    [confirmId, setConfirmId] = useState<string>(),
    [reviewConflicts, setReviewConflicts] = useState<readonly { date: string; roomName: string; source: string }[]>(),
    [confirmingBlock, setConfirmingBlock] = useState(false),
    [reasonChoice, setReasonChoice] = useState("Mantención");
  const [checkIn, setIn] = useState(initialSelection?.checkIn ?? ""),
    [checkOut, setOut] = useState(initialSelection?.checkOut ?? "");
  const submit = async (data: FormData) => {
    setPending(true);
    setMessage(undefined);
    try {
      const checked = review ? await review(data) : { kind: "clear" as const };
      if (checked.kind === "failure") { setMessage(checked.message ?? "No pudimos revisar los bloqueos."); return; }
      if (checked.kind === "conflicts") { setReviewConflicts(checked.conflicts ?? []); return; }
      const r = await create(data);
      const names = r.roomIds?.map((id) => rooms.find((room) => room.id === id)?.name ?? id).join(", ");
      setMessage(r.ok ? `Bloqueos creados: ${names ?? ""}.` : (r.message ?? "No pudimos crear los bloqueos."));
      if (r.ok) router.refresh();
    } catch {
      setMessage("No pudimos crear los bloqueos.");
    } finally {
      setPending(false);
    }
  };
  let count;
  try {
    count = checkIn && checkOut ? nights(checkIn, checkOut) : undefined;
  } catch {}
  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (filters?.roomId) params.set("roomId", filters.roomId);
    if (filters?.checkIn) params.set("checkIn", filters.checkIn);
    if (filters?.checkOut) params.set("checkOut", filters.checkOut);
    if (filters?.reason) params.set("reason", filters.reason);
    if (filters?.status) params.set("status", filters.status);
    params.set("page", String(nextPage));
    return `?${params.toString()}`;
  };
  return (
    <div className="space-y-4">
      <form
        method="get"
        aria-label="Filtrar bloqueos"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4"
      >
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm font-medium text-foreground">
          Habitación
          <select aria-label="Habitación filtro" name="roomId" defaultValue={filters?.roomId ?? ""} className={controlClass}>
            <option value="">Todas las habitaciones</option>
            {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
          Entrada
          <input type="date" name="checkIn" defaultValue={filters?.checkIn} aria-label="Entrada filtro" className={controlClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
          Salida
          <input type="date" name="checkOut" defaultValue={filters?.checkOut} aria-label="Salida filtro" className={controlClass} />
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm font-medium text-foreground">
          Motivo
          <input name="reason" defaultValue={filters?.reason} placeholder="Motivo" aria-label="Motivo filtro" className={controlClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
          Estado
          <select name="status" defaultValue={filters?.status ?? "active"} aria-label="Estado" className={controlClass}>
            <option value="active">Activos</option>
            <option value="removed">Retirados</option>
            <option value="all">Todos</option>
          </select>
        </label>
        <div className="flex min-h-11 items-center gap-3">
          <Button type="submit">Filtrar</Button>
          <a href="/admin/bloqueos" className="text-sm font-semibold text-muted-foreground hover:underline">Limpiar filtros</a>
        </div>
      </form>
      {reviewConflicts && (
        <section role="dialog" aria-label="Confirmar conflictos de bloqueo" className="rounded-xl border border-destructive/40 bg-card p-4">
          <h2 className="font-heading text-xl">Conflictos detectados</h2>
          <p className="mt-2 text-sm text-muted-foreground">Estos bloqueos coexistirán con la ocupación existente. Confirma sólo si corresponde.</p>
          <ul className="mt-3 list-disc pl-5 text-sm">{reviewConflicts.map((conflict, index) => <li key={`${conflict.date}-${conflict.roomName}-${index}`}>{conflict.date}: {conflict.roomName} ({conflict.source})</li>)}</ul>
          <div className="mt-4 flex gap-3">
            <Button type="button" variant="secondary" disabled={confirmingBlock} onClick={() => setReviewConflicts(undefined)}>Cancelar</Button>
            <Button
              type="button"
              variant="destructive"
              loading={confirmingBlock}
              onClick={async () => {
                if (!confirm || confirmingBlock) return;
                setConfirmingBlock(true);
                try {
                  const data = new FormData();
                  document.querySelectorAll<HTMLFormElement>('form[aria-label="Crear bloqueos"] input, form[aria-label="Crear bloqueos"] select').forEach((field) => { if ((field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio") && !field.checked) || !field.name) return; data.append(field.name, field.value); });
                  data.set("confirmConflicts", "true");
                  const result = await confirm(data);
                  setMessage(result.ok ? "Bloqueos confirmados." : (result.message ?? "No pudimos crear los bloqueos."));
                  setReviewConflicts(undefined);
                  if (result.ok) router.refresh();
                } finally {
                  setConfirmingBlock(false);
                }
              }}
            >
              {confirmingBlock ? "Confirmando…" : "Confirmar bloqueo"}
            </Button>
          </div>
        </section>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit(new FormData(event.currentTarget));
        }}
        aria-label="Crear bloqueos"
        className="space-y-4 rounded-xl border border-border bg-card p-4"
      >
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-foreground">Habitaciones</legend>
          <div className="grid gap-2 phone:grid-cols-2 tablet:grid-cols-3">
          {rooms.map((room) => (
            <label key={room.id} className="flex min-h-11 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm">
              <input
                type="checkbox"
                name="roomIds"
                value={room.id}
                defaultChecked={initialSelection?.roomId === room.id}
              />
              {room.name}
            </label>
          ))}
          </div>
        </fieldset>
        <div className="grid gap-3 phone:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
          Entrada
          <input
            type="date"
            name="checkIn"
            value={checkIn}
            onChange={(e) => setIn(e.target.value)}
            required
            className={controlClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
          Salida
          <input
            type="date"
            name="checkOut"
            value={checkOut}
            onChange={(e) => setOut(e.target.value)}
            required
            className={controlClass}
          />
        </label>
        </div>
        {count && <p>{count} noches</p>}
        <label className="flex max-w-xs flex-col gap-1 text-sm font-medium text-foreground">
          Motivo sugerido
          <select
            value={reasonChoice}
            onChange={(event) => setReasonChoice(event.target.value)}
            className={controlClass}
          >
            <option value="Mantención">Mantención</option>
            <option value="Limpieza">Limpieza</option>
            <option value="Otro">Otro</option>
          </select>
        </label>
        {reasonChoice === "Otro" ? (
          <label className="flex max-w-md flex-col gap-1 text-sm font-medium text-foreground">
            Motivo libre
            <input name="reason" required className={controlClass} />
          </label>
        ) : (
          <input type="hidden" name="reason" value={reasonChoice} />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={pending}>
            {pending ? "Creando…" : "Crear bloqueos"}
          </Button>
          <p role="status" className="text-sm text-muted-foreground">{message}</p>
        </div>
      </form>
      <section aria-labelledby="bloques" className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 id="bloques" className="font-heading text-xl text-foreground">Bloques ({total})</h2>
          <p className="mt-1 text-sm text-muted-foreground">Para cambiar un bloqueo, retíralo y crea uno nuevo.</p>
        </div>
        <ul className="divide-y divide-border">
          {blocks.map((block) => (
            <li key={block.id} className="space-y-3 px-4 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">
                    {rooms.find((room) => room.id === block.roomId)?.name ?? "Habitación"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {block.checkIn} a {block.checkOut} · {block.nights} noches
                  </p>
                </div>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${block.removedAt ? "bg-muted text-muted-foreground" : "bg-[var(--admin-reservation-confirmed-background)] text-[var(--admin-reservation-confirmed)]"}`}>
                  {block.removedAt ? "Retirado" : "Activo"}
                </span>
              </div>
              <p className="text-sm text-foreground">{block.reason}</p>
              <p className="text-xs text-muted-foreground">
                creado por {block.createdBy} · creado {block.createdAt.toISOString().slice(0, 10)}
                {block.removedAt
                  ? ` · retirado por ${block.removedBy} · retirado ${block.removedAt.toISOString().slice(0, 10)}`
                  : ""}
              </p>
              {!block.removedAt && (
                <Button type="button" variant="secondary" onClick={() => setConfirmId(block.id)}>
                  Retirar
                </Button>
              )}
              {confirmId === block.id && (
                <div role="dialog" aria-label="Confirmar retiro" className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-3">
                  <p className="text-sm font-medium text-foreground">¿Retirar bloqueo?</p>
                  <Button type="button" variant="secondary" onClick={() => setConfirmId(undefined)}>
                    Cancelar
                  </Button>
                  <form
                    action={async (data) => {
                      await remove(data);
                      setConfirmId(undefined);
                      router.refresh();
                    }}
                  >
                    <input type="hidden" name="id" value={block.id} />
                    <Button type="submit" variant="destructive">Confirmar retiro</Button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
        <nav aria-label="Paginación de bloqueos" className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
          <p className="text-muted-foreground">Página {page} · {total} bloques</p>
          <div className="flex gap-2">
            {page > 1 && <a className="rounded-md border border-border px-3 py-2 font-semibold" href={pageHref(page - 1)}>Página anterior</a>}
            {page * pageSize < total ? <a className="rounded-md border border-border px-3 py-2 font-semibold" href={pageHref(page + 1)}>Página siguiente</a> : null}
          </div>
        </nav>
      </section>
    </div>
  );
}
