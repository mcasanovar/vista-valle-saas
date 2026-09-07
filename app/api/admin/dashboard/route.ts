import {
  getAdminDashboardSummary,
  resolveAdminDashboardMonth,
} from "@/features/admin/dashboard";
import { requireAdministrator } from "@/infrastructure/auth/authorization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdministrator();
  } catch {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const month = new URL(request.url).searchParams.get("month") ?? undefined;

  return Response.json(
    await getAdminDashboardSummary(resolveAdminDashboardMonth(month))
  );
}
