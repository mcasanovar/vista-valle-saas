## Context

`src/features/admin/dashboard.ts` today only implements `context === "mock"`; production returns `null` and the Resumen screen (`app/(admin-protected)/admin/page.tsx`) shows "no disponible". The rest of the admin already has a working production pattern for exactly this shape of problem — `operational-alerts.ts` / `operational-alerts-source.ts` branch on `createDatabaseBoundary()` and query Postgres via Drizzle only when `boundary.context === "production"`, mirroring the mock behavior otherwise. `admin-reservation-source.ts` (used by `/admin/reservas`) already queries `reservations`, `payments`, `reservationItems`, and `rooms` with the exact fields this change needs (`origin`, `totalClp`, `checkIn`/`checkOut`, `status`, `payments.status`/`amountClp`). See `proposal.md` for why this data needs to exist and how each metric is defined; this document covers how to compute and serve it.

## Goals / Non-Goals

**Goals:**
- Compute all month-scoped metrics with bounded-cost SQL (aggregate queries filtered to one calendar month), never a full-table scan.
- Reuse the existing production/mock branching pattern instead of inventing a new one.
- Ship the new visualizations (channel breakdown, per-room occupancy, daily sales) without adding a charting dependency.

**Non-Goals:**
- No caching/materialized-aggregates layer. A single property has a low enough reservation volume that a direct per-request aggregate query is cheap; this is a deferred optimization, not part of this change.
- No historical tracking of `rooms.active` toggles. The schema only stores the current boolean plus `createdAt`; reconstructing "this room was active from day 5 to day 20 of the month" for a room that was toggled off and back on mid-month is out of scope (see Risks).
- No change to how `activeReservations`/`pendingPaymentsClp` are computed for the **mock** context — the mock source (`createAdminDashboardSource("mock", ...)`) is exercised by existing tests and is out of scope; only its shape changes to match the new KPI set, with mock values recomputed to match the new definitions.

## Decisions

### 1. Month boundary comparison stays string-based, no timezone math
`reservations.checkIn`/`checkOut` are Postgres `date` columns stored as plain ISO strings (`YYYY-MM-DD`), already representing the Chile-local calendar date the earlier passed-date validation (`proposal 12.1`) enforces. A selected month `YYYY-MM` becomes `checkIn >= '<month>-01' AND checkIn <= '<month>-<lastDay>'`; both sides are ISO date strings, which compare correctly with `gte`/`lte` exactly like `admin-reservation-source.ts` already does for its check-in range filter. No `America/Santiago` conversion is needed here — that concern only applies to `timestamptz` columns (`createdAt`, `payments.receivedAt`), neither of which anchors any metric in this change.

### 2. One new aggregation module, same shape as the existing sources
Add `src/infrastructure/database/admin-dashboard-summary-source.ts` exporting a single `getAdminDashboardMonthlySummary(db, month)` that runs the queries below and returns the shaped result. `src/features/admin/dashboard.ts` gets a real production branch that calls it, following the exact `createDatabaseBoundary()` / `createProductionDatabase()` split already used in `operational-alerts.ts`. `getAdminDashboardSummary` and the `/api/admin/dashboard` route both take an optional `month` (`YYYY-MM`, default: current calendar month in `America/Santiago`).

### 3. Four independent aggregate queries, each scoped to the month
Rather than one large join, four targeted queries keep each one simple and index-friendly (`reservations.checkIn`, `reservations.origin`, `reservations.status` are all already filtered elsewhere in the admin and can share indexes with `admin-reservation-source.ts`):
- **Ganado + reservas del mes + canceladas/no-show**: one `GROUP BY status` over `reservations` joined to `payments` (`SUM(amountClp) FILTER (WHERE payments.status = 'approved')`), all scoped to `checkIn BETWEEN :from AND :to`.
- **Por canal**: `GROUP BY origin` over the same filtered set, restricted to `status IN ('confirmed', 'completed')`, projecting `{origin, reservationCount, approvedAmountClp}`.
- **Ocupación por habitación**: per `reservationItems.roomId`, sum of `LEAST(checkOut, monthEnd+1) - GREATEST(checkIn, monthStart)` nights for reservations with `status IN ('confirmed','completed')` and `EXISTS (SELECT 1 FROM payments WHERE reservationId = ... AND status = 'approved')`, divided by each room's available nights in the month (see Decision 4).
- **Ventas por día**: `GROUP BY checkIn` over approved-payment amounts for the same filtered, valid-status reservations; zero-filled for every day of the month server-side before rendering so the chart never has gaps.

All four run in parallel (`Promise.all`), same as `getOperationalAlerts` already does for its two independent lookups.

### 4. Room occupancy denominator uses `createdAt` as a best-effort inception bound
The schema has no room-status history table — only `rooms.active` (current boolean) and `rooms.createdAt`. A room's available nights in the month are computed as the days between `GREATEST(room.createdAt, monthStart)` and `monthEnd` for every room where `active = true` today; a currently-inactive room is excluded from the occupancy breakdown entirely rather than partially prorated. This is an intentional approximation (see Risks) — it correctly handles "room added mid-month" but not "room deactivated and later reactivated mid-month."

### 5. Charts are server-rendered inline SVG, no new dependency
Neither `recharts` nor any other charting library is in `package.json`. Given the data volume (≤31 points for the daily chart, ≤6 for the channel breakdown, one bar per room for occupancy) and that this is a low-traffic internal tool, both the channel breakdown and the daily sales chart are built as plain SVG/`div` markup computed server-side from the aggregate query results — same approach as the existing skeleton/shimmer blocks, no client-side charting runtime, zero added bundle weight. The channel breakdown renders amount as bar length and reservation count as an adjacent numeric badge in the same row, per the approved distinguishable-in-one-visualization requirement.

### 6. Month selection is a URL search param, not client state
`app/(admin-protected)/admin/page.tsx` becomes `searchParams`-aware (`?month=YYYY-MM`), exactly like `app/(admin-protected)/admin/reservas/page.tsx` already does for its filters — keeps the summary bookmarkable/shareable and server-rendered on first load. The existing client-side "Actualizar datos" button (`admin-dashboard-view.tsx`, currently `fetch("/api/admin/dashboard")`) continues to work for a same-month refresh; the new month selector navigates (`router.push`/`Link` with the updated `?month=`) so the server component re-runs with the new range, and the API route forwards `?month=` to `getAdminDashboardSummary` for the client-refresh path to stay consistent with the server-rendered one.

## Risks / Trade-offs

- **[Risk] Room occupancy denominator can't perfectly reconstruct mid-month deactivation/reactivation** (no history table) → Mitigation: document the approximation (Decision 4) in the room's tooltip/label if it materially affects a room's percentage; accept the gap for v1 since toggling a room's `active` flag is rare and administrator-driven, not a frequent event.
- **[Risk] Four separate queries per request instead of one join** → Mitigation: each is already scoped to a single month and indexed columns, and low reservation volume for a single property keeps this cheap; revisit only if real usage shows otherwise (see Non-Goals on caching).
- **[Trade-off] Custom SVG charts instead of a library** → gains: zero new dependency, full control over theming with the existing CSS variables, consistent with "cuidado con el consumo de recursos". Costs: more upfront code than dropping in `recharts`; acceptable given the small, fixed set of chart shapes needed (bars only, no interactivity beyond what shimmer/skeleton loading already requires).

## Migration Plan

No schema changes and no backfill — every query reads columns that already exist and are already populated by other admin features. This is purely additive: production today shows "no disponible" for the whole Resumen screen, so there is no working behavior to regress. Deploy is a normal code release; rollback is a normal revert, with no data cleanup needed either way.
