import { Skeleton } from "@/presentation/atoms";

export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="mx-auto max-w-content space-y-8 bg-background px-4 py-10 phone:px-6 tablet:px-8 tablet:py-14"
    >
      <div className="max-w-prose space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        Cargando habitación…
      </p>
      <div className="grid grid-cols-1 gap-4 tablet:grid-cols-3">
        <Skeleton className="aspect-[4/3] rounded-xl" />
        <Skeleton className="aspect-[4/3] rounded-xl" />
        <Skeleton className="aspect-[4/3] rounded-xl" />
      </div>
      <div className="grid gap-8 laptop:grid-cols-[1fr_auto]">
        <div className="space-y-5">
          <Skeleton className="h-7 w-40" />
          <div className="grid gap-4 tablet:grid-cols-3">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-8 w-full max-w-sm" />
        </div>
        <Skeleton className="h-52 w-full rounded-lg laptop:w-72" />
      </div>
    </main>
  );
}
