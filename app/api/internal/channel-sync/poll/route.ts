import { getServerEnvironment } from "@/config/server";
import { pollAllActiveConnections } from "@/features/channel-calendar-sync";

export const dynamic = "force-dynamic";

/** Same Bearer-secret pattern as `app/api/internal/outbox/process/route.ts`; triggered by an external cron at whatever cadence is configured operationally. */
export async function POST(request: Request) {
  const environment = getServerEnvironment();
  const authorization = request.headers.get("authorization");
  if (
    !environment.CHANNEL_SYNC_PROCESSOR_SECRET ||
    authorization !== `Bearer ${environment.CHANNEL_SYNC_PROCESSOR_SECRET}`
  ) {
    return Response.json({ message: "No autorizado." }, { status: 401 });
  }

  const outcomes = await pollAllActiveConnections();
  return Response.json({ outcomes });
}
