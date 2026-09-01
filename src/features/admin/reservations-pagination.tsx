import Link from "next/link";

function withPage(searchParams: URLSearchParams, page: number) {
  const params = new URLSearchParams(searchParams);
  params.set("page", String(page));
  return `/admin/reservas?${params.toString()}`;
}

export function ReservationsPagination({
  page,
  pageSize,
  searchParams,
  total,
}: Readonly<{
  page: number;
  pageSize: number;
  searchParams: URLSearchParams;
  total: number;
}>) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Paginación de reservas"
      className="flex items-center justify-between gap-3 text-sm"
    >
      <p className="text-muted-foreground">
        Página {page} de {totalPages} · {total} reservas
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={withPage(searchParams, page - 1)}
            className="rounded-md border border-border px-3 py-2 font-semibold"
          >
            Anterior
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link
            href={withPage(searchParams, page + 1)}
            className="rounded-md border border-border px-3 py-2 font-semibold"
          >
            Siguiente
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
