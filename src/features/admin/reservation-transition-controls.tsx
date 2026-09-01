"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/presentation/atoms";
import { useToast } from "@/presentation/organisms";

function TransitionButton({
  children,
  value,
}: Readonly<{ children: string; value: string }>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} name="to" value={value}>
      {children}
    </Button>
  );
}

export function ReservationTransitionControls({
  action,
  id,
}: Readonly<{ action: (formData: FormData) => Promise<void>; id: string }>) {
  const [message, setMessage] = useState<string>();
  const { notify } = useToast();
  return (
    <form
      action={async (data) => {
        if (!confirm("¿Confirmas este cambio de estado?")) return;
        setMessage(undefined);
        try {
          await action(data);
          setMessage("Estado actualizado.");
          notify("success", "Estado actualizado.");
        } catch {
          setMessage("No pudimos actualizar el estado.");
          notify("error", "No pudimos actualizar el estado.");
        }
      }}
      className="space-y-2"
    >
      <input type="hidden" name="id" value={id} />
      <div className="flex flex-wrap gap-2">
        <TransitionButton value="cancelled">
          Cancelar reserva
        </TransitionButton>
        <TransitionButton value="completed">
          Completar reserva
        </TransitionButton>
        <TransitionButton value="no_show">
          Marcar no presentación
        </TransitionButton>
      </div>
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
