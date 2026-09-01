"use client";
import { useState } from "react";
import { Button } from "@/presentation/atoms";
import type { ChannelPaymentBehavior, ChannelPlatform } from "./connections";

const controlClass =
  "min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground";

const platformLabel: Record<ChannelPlatform, string> = {
  airbnb: "Airbnb",
  booking: "Booking",
};

const defaultPaymentBehavior: Record<ChannelPlatform, ChannelPaymentBehavior> =
  {
    airbnb: "auto_approved",
    booking: "pay_at_property",
  };

export type ConnectionCardView = Readonly<{
  roomId: string;
  platform: ChannelPlatform;
  connection: Readonly<{
    id: string;
    outboundToken: string;
    paymentBehavior: ChannelPaymentBehavior;
    lastPolledAt?: Date;
    lastPollStatus?: "ok" | "error";
    lastPollEventCount?: number;
    lastPollError?: string;
  }> | null;
  outboundUrl: string | null;
}>;

export type RoomConnectionCards = Readonly<{
  roomId: string;
  roomName: string;
  cards: readonly ConnectionCardView[];
}>;

function statusOf(
  card: ConnectionCardView
): "not_connected" | "active" | "error" {
  if (!card.connection) return "not_connected";
  return card.connection.lastPollStatus === "error" ? "error" : "active";
}

function ConnectionRow({
  card,
  save,
  regenerate,
}: Readonly<{
  card: ConnectionCardView;
  save: (data: FormData) => Promise<unknown>;
  regenerate: (data: FormData) => Promise<unknown>;
}>) {
  const status = statusOf(card);
  const [editing, setEditing] = useState(status === "not_connected");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-3 border-t border-border px-4 py-4 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-foreground">
          {platformLabel[card.platform]}
        </p>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
            status === "active"
              ? "bg-[var(--admin-reservation-confirmed-background)] text-[var(--admin-reservation-confirmed)]"
              : status === "error"
                ? "bg-destructive/15 text-destructive"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {status === "active"
            ? "● Activa"
            : status === "error"
              ? "⚠ Con error"
              : "○ Sin conectar"}
        </span>
      </div>

      {status === "error" && card.connection?.lastPollError && (
        <p className="text-sm text-destructive">
          {card.connection.lastPollError}
        </p>
      )}

      {status !== "not_connected" && card.connection && !editing && (
        <div className="space-y-2 text-sm text-foreground">
          <p>
            Feed entrante:{" "}
            <span className="font-medium text-muted-foreground">
              configurado ✓
            </span>{" "}
            <button
              type="button"
              className="cursor-pointer font-semibold underline underline-offset-4"
              onClick={() => setEditing(true)}
            >
              Reemplazar
            </button>
          </p>
          {card.outboundUrl && (
            <p className="flex flex-wrap items-center gap-2">
              Feed saliente:{" "}
              <code className="rounded bg-muted px-2 py-1 text-xs">
                {card.outboundUrl}
              </code>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                aria-label="Copiar link del feed saliente"
                onClick={async () => {
                  await navigator.clipboard.writeText(card.outboundUrl!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "✓" : "📋"}
              </Button>
            </p>
          )}
          <form
            action={async (data) => {
              if (
                !confirm(
                  "¿Regenerar el link? El link anterior dejará de funcionar."
                )
              )
                return;
              setPending(true);
              try {
                await regenerate(data);
                setMessage("Link regenerado.");
              } catch {
                setMessage("No pudimos regenerar el link.");
              } finally {
                setPending(false);
              }
            }}
          >
            <input type="hidden" name="id" value={card.connection.id} />
            <Button type="submit" variant="secondary" loading={pending}>
              ⟳ Regenerar link
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            {card.connection.lastPolledAt
              ? `Última sincronización: ${card.connection.lastPolledAt.toLocaleString("es-CL")}${
                  card.connection.lastPollEventCount !== undefined
                    ? ` · ${card.connection.lastPollEventCount} eventos`
                    : ""
                }`
              : "Última sincronización: pendiente del primer sondeo"}
          </p>
          <p className="text-xs text-muted-foreground">
            Pago:{" "}
            {card.connection.paymentBehavior === "auto_approved"
              ? "se registra como aprobado automáticamente"
              : "pendiente de pago al llegar"}
          </p>
        </div>
      )}

      {editing && (
        <form
          aria-label={`Configurar conexión ${platformLabel[card.platform]}`}
          className="space-y-2"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            setMessage(undefined);
            try {
              await save(new FormData(event.currentTarget));
              setMessage("Conexión guardada.");
              setEditing(false);
            } catch {
              setMessage("No pudimos guardar la conexión.");
            } finally {
              setPending(false);
            }
          }}
        >
          <input type="hidden" name="roomId" value={card.roomId} />
          <input type="hidden" name="platform" value={card.platform} />
          <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
            URL del feed de {platformLabel[card.platform]}
            <input
              type="url"
              name="inboundFeedUrl"
              required
              placeholder={`https://.../${card.platform}/ical...`}
              className={controlClass}
            />
          </label>
          <label className="flex max-w-xs flex-col gap-1 text-sm font-medium text-foreground">
            Comportamiento de pago
            <select
              name="paymentBehavior"
              defaultValue={defaultPaymentBehavior[card.platform]}
              className={controlClass}
            >
              <option value="auto_approved">Aprobado automáticamente</option>
              <option value="pay_at_property">Pago al llegar</option>
            </select>
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" loading={pending}>
              {status === "not_connected"
                ? "Configurar conexión"
                : "Guardar"}
            </Button>
            {status !== "not_connected" && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditing(false)}
              >
                Cancelar
              </Button>
            )}
          </div>
        </form>
      )}

      <p role="status" className="text-sm text-muted-foreground">
        {message}
      </p>
    </div>
  );
}

export function ChannelConnectionsPanel({
  rooms,
  save,
  regenerate,
}: Readonly<{
  rooms: readonly RoomConnectionCards[];
  save: (data: FormData) => Promise<unknown>;
  regenerate: (data: FormData) => Promise<unknown>;
}>) {
  return (
    <section aria-labelledby="channel-connections-title" className="space-y-4">
      <div>
        <h2 id="channel-connections-title" className="font-heading text-xl text-foreground">
          Conexiones de canal
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sincroniza automáticamente el calendario con Airbnb y Booking.
        </p>
      </div>
      {rooms.map((room) => (
        <div
          key={room.roomId}
          className="overflow-hidden rounded-xl border border-border bg-card"
        >
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-semibold text-foreground">{room.roomName}</h3>
          </div>
          {room.cards.map((card) => (
            <ConnectionRow
              key={`${card.roomId}-${card.platform}`}
              card={card}
              save={save}
              regenerate={regenerate}
            />
          ))}
        </div>
      ))}
    </section>
  );
}
