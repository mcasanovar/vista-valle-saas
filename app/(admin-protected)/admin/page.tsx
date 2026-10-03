import { AdminDashboardView } from "@/features/admin/admin-dashboard-view";
import {
  getAdminDashboardSummary,
  resolveAdminDashboardPeriod,
} from "@/features/admin/dashboard";
import { requireAdministrator } from "@/infrastructure/auth/authorization";

type SearchParams = Readonly<{ year?: string; month?: string }>;

export const dynamic = "force-dynamic";

export default async function AdminTechnicalPage({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  await requireAdministrator();
  const query = await searchParams;
  const period = resolveAdminDashboardPeriod(query);
  const summary = await getAdminDashboardSummary(period);

  return (
    <AdminDashboardView initialPeriod={period} initialSummary={summary} />
  );
}
