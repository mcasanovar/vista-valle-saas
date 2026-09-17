"use client";

import { useState } from "react";
import { Badge, Button, Feedback } from "@/presentation/atoms";

const OPERATION_LABELS: Record<string, string> = {
  cambiar_estado: "Cambiar estado de reserva",
  crear_bloqueo: "Bloquear habitación",
  crear_reserva: "Crear reserva manual",
  editar_fechas: "Editar fechas de reserva",
  eliminar_bloqueo: "Eliminar bloqueo",
  registrar_cobro: "Registrar cobro",
};

function fieldLabel(key: string) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (char) => char.toUpperCase());
}

function fieldValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export type AssistantProposalCardProps = Readonly<{
  cancel: (token: string) => Promise<void>;
  confirm: (token: string) => Promise<Readonly<{
    data?: Readonly<Record<string, unknown>>;
    message?: string;
    ok: boolean;
  }>>;
  onResolved: (
    token: string,
    outcome: Readonly<{ message?: string; ok: boolean }>
  ) => void;
  operation: string;
  payload: Readonly<Record<string, unknown>>;
  token: string;
}>;

/**
 * The write-tool proposal card (task 8.4): shows the operation, entity,
 * and absolute values the assistant proposed, and never applies anything
 * until the administrator explicitly presses "Confirmar" — pressing
 * "Cancelar" or leaving it alone changes nothing.
 */
export function AssistantProposalCard({
  cancel,
  confirm,
  onResolved,
  operation,
  payload,
  token,
}: AssistantProposalCardProps) {
  const [pending, setPending] = useState<"cancel" | "confirm" | null>(null);
  const [resolved, setResolved] = useState<"cancelled" | "confirmed" | null>(
    null
  );
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  async function handleConfirm() {
    setPending("confirm");
    setFailureMessage(null);
    try {
      const outcome = await confirm(token);
      if (outcome.ok) {
        setResolved("confirmed");
      } else {
        setFailureMessage(outcome.message ?? "No pudimos confirmar la propuesta.");
      }
      onResolved(token, outcome);
    } finally {
      setPending(null);
    }
  }

  async function handleCancel() {
    setPending("cancel");
    try {
      await cancel(token);
      setResolved("cancelled");
      onResolved(token, { ok: true });
    } finally {
      setPending(null);
    }
  }

  const entries = Object.entries(payload).filter(
    ([, value]) => value !== undefined
  );

  if (resolved === "confirmed") {
    return (
      <Feedback title="Propuesta confirmada" variant="success">
        Se aplicó la operación.
      </Feedback>
    );
  }
  if (resolved === "cancelled") {
    return (
      <Feedback title="Propuesta cancelada" variant="info">
        No se hizo ningún cambio.
      </Feedback>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border-2 border-primary bg-card p-4">
      <Badge variant="warning">Propuesta pendiente</Badge>
      <p className="font-heading text-lg text-foreground">
        {OPERATION_LABELS[operation] ?? operation}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {entries.map(([key, value]) => (
          <div className="contents" key={key}>
            <dt className="text-muted-foreground">{fieldLabel(key)}</dt>
            <dd className="text-foreground">{fieldValue(value)}</dd>
          </div>
        ))}
      </dl>
      {failureMessage ? (
        <Feedback title="No pudimos confirmar" variant="error">
          {failureMessage}
        </Feedback>
      ) : null}
      <div className="flex gap-2">
        <Button
          loading={pending === "confirm"}
          onClick={handleConfirm}
          disabled={pending !== null}
        >
          Confirmar
        </Button>
        <Button
          disabled={pending !== null}
          loading={pending === "cancel"}
          onClick={handleCancel}
          variant="secondary"
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
