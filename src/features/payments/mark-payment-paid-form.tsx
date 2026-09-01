"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/presentation/atoms";
import { useToast } from "@/presentation/organisms";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      {pending ? "Marcando…" : "Marcar como pagado"}
    </Button>
  );
}

export function MarkPaymentPaidForm({
  action,
  paymentId,
  reservationId,
}: Readonly<{
  action: (data: FormData) => Promise<unknown>;
  paymentId: string;
  reservationId: string;
}>) {
  const [message, setMessage] = useState<string>();
  const { notify } = useToast();
  return (
    <form
      action={async (data) => {
        setMessage(undefined);
        try {
          await action(data);
          setMessage("Pago marcado como pagado.");
          notify("success", "Pago marcado como pagado.");
        } catch {
          setMessage("No pudimos marcar el pago como pagado.");
          notify("error", "No pudimos marcar el pago como pagado.");
        }
      }}
      aria-label="Marcar pago como pagado"
      className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/40 p-3"
    >
      <input type="hidden" name="paymentId" value={paymentId} />
      <input type="hidden" name="reservationId" value={reservationId} />
      <SubmitButton />
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
