import { Skeleton } from "@/presentation/atoms";

export default function Loading() {
  return (
    <section aria-busy="true" aria-live="polite" className="space-y-4">
      <Skeleton className="h-8 w-56" />
      <p role="status" className="text-sm text-muted-foreground">
        Cargando reservas…
      </p>
      <div className="space-y-3">
        {["skeleton-1", "skeleton-2", "skeleton-3", "skeleton-4"].map(
          (key) => (
            <Skeleton key={key} className="h-16 rounded-lg" />
          )
        )}
      </div>
    </section>
  );
}
