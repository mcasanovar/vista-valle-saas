import { AdminDashboardView } from "@/features/admin/admin-dashboard-view";
import {
  getAdminDashboardSummary,
  resolveAdminDashboardMonth,
} from "@/features/admin/dashboard";

type SearchParams = Readonly<{ month?: string }>;

export const dynamic = "force-dynamic";

export default async function AdminTechnicalPage({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const query = await searchParams;
  const month = resolveAdminDashboardMonth(query.month);
  const summary = await getAdminDashboardSummary(month);

  return <AdminDashboardView initialMonth={month} initialSummary={summary} />;
}
