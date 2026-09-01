import { getAdminDashboardSummary } from "@/features/admin/dashboard";
import { requireAdministrator } from "@/infrastructure/auth/authorization";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdministrator();
  } catch {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  return Response.json(await getAdminDashboardSummary());
}
