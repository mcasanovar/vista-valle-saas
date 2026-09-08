import {
  getAdminDashboardSummary,
  resolveAdminDashboardPeriod,
} from "@/features/admin/dashboard";
import { requireAdministrator } from "@/infrastructure/auth/authorization";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdministrator();
  } catch {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const period = resolveAdminDashboardPeriod({
    month: searchParams.get("month") ?? undefined,
    year: searchParams.get("year") ?? undefined,
  });

  return Response.json(await getAdminDashboardSummary(period));
}
