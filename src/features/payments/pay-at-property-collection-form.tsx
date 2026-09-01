"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Label } from "@/presentation/atoms";
import { useToast } from "@/presentation/organisms";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {pending ? "Registrando…" : "Registrar cobro"}
    </Button>
  );
}

export function PayAtPropertyCollectionForm({
  action,
  reservationId,
  totalClp,
}: Readonly<{
  action: (data: FormData) => Promise<unknown>;
  reservationId: string;
  totalClp: number;
}>) {
  const [message, setMessage] = useState<string>();
  const { notify } = useToast();
  return (
    <form
      action={async (data) => {
        setMessage(undefined);
        try {
          await action(data);
          setMessage("Cobro registrado.");
          notify("success", "Cobro registrado.");
        } catch {
          setMessage("No pudimos registrar el cobro.");
          notify("error", "No pudimos registrar el cobro.");
        }
      }}
      aria-label="Registrar cobro presencial"
      className="mt-3 grid gap-3 rounded-lg border border-border bg-muted/40 p-3 tablet:grid-cols-4 tablet:items-end"
    >
      <input type="hidden" name="reservationId" value={reservationId} />
      <div>
        <Label htmlFor="collect-amount">Monto</Label>
        <Input
          id="collect-amount"
          name="amountClp"
          type="number"
          defaultValue={totalClp}
          required
        />
      </div>
      <div>
        <Label htmlFor="collect-date">Fecha</Label>
        <Input
          id="collect-date"
          name="collectedOn"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
        />
      </div>
      <div>
        <Label htmlFor="collect-medium">Medio</Label>
        <Input
          id="collect-medium"
          name="medium"
          defaultValue="Efectivo"
          required
        />
      </div>
      <SubmitButton />
      {message ? (
        <p role="status" className="tablet:col-span-4">
          {message}
        </p>
      ) : null}
    </form>
  );
}
