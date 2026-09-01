import { Skeleton } from "@/presentation/atoms";

export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="mx-auto max-w-content space-y-7 bg-warm px-4 py-10 phone:px-6 tablet:px-8 tablet:py-14"
    >
      <div className="max-w-prose space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        Cargando habitaciones…
      </p>
      <div className="grid gap-5 tablet:grid-cols-2 laptop:grid-cols-3">
        {["skeleton-1", "skeleton-2", "skeleton-3"].map((key) => (
          <Skeleton key={key} className="h-[31rem] rounded-lg shadow-md" />
        ))}
      </div>
    </main>
  );
}
