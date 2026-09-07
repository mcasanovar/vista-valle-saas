import { Skeleton } from "@/presentation/atoms";

export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="mx-auto max-w-content space-y-8 bg-background px-4 py-10 phone:px-6 tablet:px-8 tablet:py-14"
    >
      <Skeleton className="h-12 w-56 rounded" />
      <p role="status" className="text-sm text-muted-foreground">
        Cargando ubicación…
      </p>
      <Skeleton className="h-[24rem] rounded-lg shadow-sm tablet:h-[28rem]" />
      <div className="grid gap-7 tablet:grid-cols-2">
        <Skeleton className="h-24 rounded" />
        <Skeleton className="h-24 rounded" />
      </div>
    </main>
  );
}
