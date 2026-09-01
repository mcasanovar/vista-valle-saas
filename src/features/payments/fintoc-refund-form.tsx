"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Input, Label } from "@/presentation/atoms";
import { useToast } from "@/presentation/organisms";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="destructive" loading={pending}>
      {pending ? "Reembolsando…" : "Reembolsar"}
    </Button>
  );
}

export function FintocRefundForm({
  action,
  paymentId,
  remainingClp,
}: Readonly<{
  action: (data: FormData) => Promise<unknown>;
  paymentId: string;
  remainingClp: number;
}>) {
  const [message, setMessage] = useState<string>();
  const { notify } = useToast();
  return (
    <form
      action={async (data) => {
        setMessage(undefined);
        try {
          await action(data);
          setMessage("Reembolso procesado.");
          notify("success", "Reembolso procesado.");
        } catch {
          setMessage("No pudimos procesar el reembolso.");
          notify("error", "No pudimos procesar el reembolso.");
        }
      }}
      aria-label="Reembolsar pago de Fintoc"
      className="mt-3 grid gap-3 rounded-lg border border-border bg-muted/40 p-3 tablet:grid-cols-3 tablet:items-end"
    >
      <input type="hidden" name="paymentId" value={paymentId} />
      <div>
        <Label htmlFor="refund-amount">Monto a reembolsar</Label>
        <Input
          id="refund-amount"
          name="amountClp"
          type="number"
          max={remainingClp}
          min={1}
          defaultValue={remainingClp}
          required
        />
      </div>
      <SubmitButton />
      {message ? (
        <p role="status" className="tablet:col-span-3">
          {message}
        </p>
      ) : null}
    </form>
  );
}
