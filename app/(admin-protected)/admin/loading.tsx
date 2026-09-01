export default function AdminDashboardLoading() {
  return (
    <section aria-busy="true" className="space-y-5">
      <p role="status" className="sr-only">
        Cargando resumen operativo
      </p>
      <div className="grid grid-cols-2 gap-3 laptop:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="admin-dashboard-shimmer h-[104px] rounded-xl border border-border"
          />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="admin-dashboard-shimmer h-64 rounded-xl border border-border"
      />
    </section>
  );
}
