import type { PublicBookingConfirmation } from "./confirm-pay-at-property";

import { ActionLink, Heading, Icon, type IconName } from "@/presentation/atoms";
import { Price } from "@/presentation/molecules";

const ACCENT = "#B6976D";

type SummaryField = Readonly<{
  icon: IconName;
  label: string;
  value: string;
  highlight?: boolean;
}>;

/** Presentation-only confirmation; it receives already redacted server data. */
export function BookingConfirmationView({
  confirmation,
}: Readonly<{ confirmation: PublicBookingConfirmation }>) {
  const paidOnline = confirmation.paymentMode === "PAY_NOW";
  const fields: readonly SummaryField[] = [
    {
      icon: "Bookmark",
      label: "Identificador de reserva",
      value: confirmation.publicId,
    },
    { icon: "BedDouble", label: "Habitación", value: confirmation.room.name },
    { icon: "Calendar", label: "Entrada", value: confirmation.checkIn },
    { icon: "Calendar", label: "Salida", value: confirmation.checkOut },
    { icon: "Moon", label: "Noches", value: String(confirmation.nights) },
    {
      icon: "User",
      label: "Huéspedes",
      value: String(confirmation.guestCount),
    },
    {
      icon: "CreditCard",
      label: "Modalidad de pago",
      value: paidOnline ? "Pagado en línea con Fintoc" : "Pagar al llegar",
    },
  ];

  return (
    <main className="min-h-dvh bg-warm px-4 py-12 phone:px-6 tablet:px-8">
      <section
        aria-label={`Reserva confirmada para ${confirmation.guest.firstName}`}
        className="animate-fade-in-up mx-auto max-w-[calc(42rem+180px)] space-y-8 rounded-2xl border border-border bg-card p-6 shadow-lg tablet:p-10"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex w-full items-center gap-4">
            <div
              className="h-px flex-1 rounded-md opacity-40"
              style={{ backgroundColor: ACCENT }}
            />
            <div
              className="animate-check-pop flex size-14 shrink-0 items-center justify-center rounded-full border-2 bg-[#B6976D]/10 [animation-delay:150ms]"
              style={{ borderColor: ACCENT }}
            >
              <Icon
                decorative
                name="Check"
                className="size-6 text-[#B6976D]"
              />
            </div>
            <div
              className="h-px flex-1 rounded-md opacity-40"
              style={{ backgroundColor: ACCENT }}
            />
          </div>
          <p
            role="status"
            className="text-xs font-semibold tracking-[0.2em] uppercase"
            style={{ color: ACCENT }}
          >
            Reserva confirmada
          </p>
          <Heading level={1}>Gracias, {confirmation.guest.firstName}</Heading>
          <div className="flex items-center gap-3">
            <div
              className="h-px w-16 rounded-md opacity-50"
              style={{ backgroundColor: ACCENT }}
            />
            <span
              className="size-1.5 rotate-45"
              style={{ backgroundColor: ACCENT }}
            />
            <div
              className="h-px w-16 rounded-md opacity-50"
              style={{ backgroundColor: ACCENT }}
            />
          </div>
          {paidOnline ? null : (
            <p className="text-body text-muted-foreground">
              Tu pago permanece pendiente y se realizará al llegar a Vista
              Valle.
            </p>
          )}
          <p className="text-body text-muted-foreground">
            Te enviaremos a tu correo la confirmación de esta reserva y sus
            datos.
          </p>
        </div>

        <dl className="grid gap-4 tablet:grid-cols-2">
          {fields.map((field) => (
            <div
              key={field.label}
              className="flex items-center gap-4 rounded-xl border border-border p-4"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#B6976D]/15 text-foreground">
                <Icon decorative name={field.icon} className="size-5" />
              </span>
              <div>
                <dt className="text-sm text-muted-foreground">
                  {field.label}
                </dt>
                <dd className="mt-1 font-semibold break-all">
                  {field.value}
                </dd>
              </div>
            </div>
          ))}
          <div
            className="flex items-center gap-4 rounded-xl border p-4 bg-[#B6976D]/10"
            style={{ borderColor: ACCENT }}
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#B6976D]/15 text-foreground">
              <Icon decorative name="Tag" className="size-5" />
            </span>
            <div>
              <dt className="text-sm text-muted-foreground">
                {paidOnline ? "Total pagado" : "Total pendiente"}
              </dt>
              <dd className="mt-1">
                <Price
                  amount={confirmation.totalClp}
                  className="text-lg font-bold"
                />
              </dd>
            </div>
          </div>
        </dl>

        <div className="flex justify-center">
          <ActionLink href="/" variant="action">
            Volver al inicio
          </ActionLink>
        </div>
      </section>
    </main>
  );
}
