import { Skeleton } from "@/presentation/atoms";

export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="mx-auto max-w-content space-y-8 bg-background px-4 py-10 phone:px-6 tablet:px-8 tablet:py-14"
    >
      <Skeleton className="h-12 w-56 rounded" />
      <Skeleton className="h-40 rounded-xl shadow-sm" />
      <p role="status" className="text-sm text-muted-foreground">
        Cargando disponibilidad…
      </p>
      <div className="grid gap-5 tablet:grid-cols-2 laptop:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-[31rem] rounded-lg shadow-md" />
        ))}
      </div>
    </main>
  );
}
