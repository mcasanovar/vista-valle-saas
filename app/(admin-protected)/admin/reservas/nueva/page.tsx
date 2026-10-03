import { ManualReservationForm } from "@/features/admin/manual-reservation-form";
import { createManualReservationAction } from "@/features/admin/manual-reservation-action";
import { getManualReservationInitialData } from "@/features/admin/manual-reservation-data";
import { requireAdministrator } from "@/infrastructure/auth/authorization";

export const dynamic = "force-dynamic";

export default async function NewManualReservationPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ roomId?: string; checkIn?: string; checkOut?: string }>;
}>) {
  await requireAdministrator();
  const [initialData, query] = await Promise.all([
    getManualReservationInitialData(),
    searchParams,
  ]);
  return (
    <section className="space-y-5 tablet:space-y-6">
      <header>
        <h1 className="font-heading text-title">Nueva reserva</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Registra una reserva externa con pago al llegar.
        </p>
      </header>
      <ManualReservationForm
        action={createManualReservationAction}
        initialData={initialData}
        initialSelection={query}
      />
    </section>
  );
}
