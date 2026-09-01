import { AdminDashboardView } from "@/features/admin/admin-dashboard-view";
import { getAdminDashboardSummary } from "@/features/admin/dashboard";

export default async function AdminTechnicalPage() {
  const summary = await getAdminDashboardSummary();

  return <AdminDashboardView initialSummary={summary} />;
}
