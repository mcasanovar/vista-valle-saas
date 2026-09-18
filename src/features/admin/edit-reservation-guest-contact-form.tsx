"use client";
import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/presentation/atoms";
import { useToast } from "@/presentation/organisms";
import type { EditReservationGuestContactActionResult } from "./edit-reservation-guest-contact-action";

const controlClass =
  "min-h-11 rounded-md border border-border bg-background px-3 text-sm text-foreground";

export function EditReservationGuestContactForm({
  action,
  company,
  email: currentEmail,
  firstName: currentFirstName,
  lastName: currentLastName,
  phone: currentPhone,
  reservationId,
  rut,
}: Readonly<{
  action: (
    data: FormData
  ) => Promise<EditReservationGuestContactActionResult>;
  company?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  reservationId: string;
  rut?: string;
}>) {
  const router = useRouter();
  const formId = useId();
  const [firstName, setFirstName] = useState(currentFirstName);
  const [lastName, setLastName] = useState(currentLastName);
  const [email, setEmail] = useState(currentEmail);
  const [phone, setPhone] = useState(currentPhone);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const { notify } = useToast();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(undefined);
    setPending(true);
    try {
      const data = new FormData();
      data.set("reservationId", reservationId);
      data.set("firstName", firstName);
      data.set("lastName", lastName);
      data.set("email", email);
      data.set("phone", phone);
      const result = await action(data);
      if (result.ok) {
        setMessage("Datos del huésped actualizados.");
        notify("success", "Datos del huésped actualizados.");
        router.refresh();
      } else {
        setMessage(result.message);
        notify("error", result.message);
      }
    } catch {
      setMessage("No pudimos actualizar los datos del huésped.");
      notify("error", "No pudimos actualizar los datos del huésped.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      aria-label="Editar datos del huésped"
      onSubmit={(event) => void submit(event)}
      className="space-y-3 rounded-xl border border-border bg-card p-4"
    >
      <div className="grid gap-3 tablet:grid-cols-2">
        <label
          htmlFor={`${formId}-first-name`}
          className="flex flex-col gap-1 text-sm font-medium text-foreground"
        >
          Nombre
          <input
            id={`${formId}-first-name`}
            name="firstName"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            required
            className={controlClass}
          />
        </label>
        <label
          htmlFor={`${formId}-last-name`}
          className="flex flex-col gap-1 text-sm font-medium text-foreground"
        >
          Apellido
          <input
            id={`${formId}-last-name`}
            name="lastName"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            required
            className={controlClass}
          />
        </label>
        <label
          htmlFor={`${formId}-email`}
          className="flex flex-col gap-1 text-sm font-medium text-foreground"
        >
          Email
          <input
            id={`${formId}-email`}
            type="email"
            name="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className={controlClass}
          />
        </label>
        <label
          htmlFor={`${formId}-phone`}
          className="flex flex-col gap-1 text-sm font-medium text-foreground"
        >
          Teléfono
          <input
            id={`${formId}-phone`}
            type="tel"
            name="phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
            className={controlClass}
          />
        </label>
      </div>
      {rut || company ? (
        <dl className="grid gap-2 tablet:grid-cols-2">
          {rut ? (
            <div>
              <dt className="text-xs text-muted-foreground">RUT</dt>
              <dd>{rut}</dd>
            </div>
          ) : null}
          {company ? (
            <div>
              <dt className="text-xs text-muted-foreground">Empresa</dt>
              <dd>{company}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      <Button type="submit" loading={pending}>
        Guardar datos del huésped
      </Button>
      {message ? (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}
    </form>
  );
}
