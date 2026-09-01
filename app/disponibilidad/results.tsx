import {
  composeAvailabilityResults,
  type AvailabilityResultsQuery,
} from "@/features/availability";
import { Skeleton } from "@/presentation/atoms";
import { AvailabilityResultsRegion } from "@/presentation/templates";

export async function AvailabilityResultsData({
  query,
}: Readonly<{ query: AvailabilityResultsQuery }>) {
  const result = await composeAvailabilityResults({
    ok: true,
    value: query,
  }).catch(() => null);
  if (!result) return <AvailabilityResultsRegion query={query} state="error" />;
  if (result.kind === "selected-room-unavailable") {
    return <AvailabilityResultsRegion query={query} state="unavailable" />;
  }
  if (result.kind !== "results") {
    return <AvailabilityResultsRegion query={query} state="error" />;
  }
  return <AvailabilityResultsRegion query={query} rooms={result.rooms} />;
}

export function AvailabilityResultsSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Cargando resultados de disponibilidad"
      className="space-y-4"
    >
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      >
        Cargando disponibilidad…
      </p>
      <div className="grid gap-5 tablet:grid-cols-2 laptop:grid-cols-3">
        {["skeleton-1", "skeleton-2", "skeleton-3"].map((key) => (
          <Skeleton key={key} className="h-[31rem] rounded-lg shadow-md" />
        ))}
      </div>
    </section>
  );
}
