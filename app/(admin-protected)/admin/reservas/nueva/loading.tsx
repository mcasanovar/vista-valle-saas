export default function NewManualReservationLoading() {
  return (
    <section aria-busy="true" aria-live="polite" className="space-y-5">
      <p role="status" className="sr-only">
        Cargando formulario de reserva manual
      </p>
      <div
        aria-hidden="true"
        className="space-y-3 rounded-xl border border-border bg-card p-5"
      >
        <div className="admin-dashboard-shimmer h-7 w-52 rounded" />
        <div className="admin-dashboard-shimmer h-4 w-72 rounded" />
        <div className="grid gap-4 tablet:grid-cols-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="space-y-2">
              <div className="admin-dashboard-shimmer h-3 w-24 rounded" />
              <div className="admin-dashboard-shimmer h-11 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
