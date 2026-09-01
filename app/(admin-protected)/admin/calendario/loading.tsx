export default function CalendarLoading() {
  return (
    <section aria-busy="true" className="space-y-4">
      <p className="sr-only" role="status">
        Cargando calendario
      </p>
      <div
        aria-hidden="true"
        className="admin-dashboard-shimmer h-[168px] rounded-xl border border-border"
      />
      <div className="hidden overflow-hidden rounded-xl border border-border tablet:block">
        {Array.from({ length: 5 }, (_, weekIndex) => (
          <div className="grid grid-cols-7 gap-px bg-border" key={weekIndex}>
            {Array.from({ length: 7 }, (_, dayIndex) => (
              <div
                aria-hidden="true"
                className="admin-dashboard-shimmer h-28"
                key={dayIndex}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="space-y-3 tablet:hidden">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            aria-hidden="true"
            className="admin-dashboard-shimmer h-32 rounded-xl border border-border"
            key={index}
          />
        ))}
      </div>
    </section>
  );
}
