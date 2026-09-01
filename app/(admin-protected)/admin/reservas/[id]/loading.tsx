import { Skeleton } from "@/presentation/atoms";

export default function Loading() {
  return (
    <section aria-busy="true" aria-live="polite" className="space-y-5">
      <p role="status" className="sr-only">
        Cargando reserva…
      </p>
      <header className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-5 w-24" />
      </header>
      {["guest", "items", "payments", "audit"].map((key) => (
        <div
          key={key}
          className="space-y-2 rounded-xl border border-border bg-card p-4"
        >
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      ))}
    </section>
  );
}
