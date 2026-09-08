import { getServerEnvironment } from "@/config/server";
import { pollAllActiveConnections } from "@/features/channel-calendar-sync";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const environment = getServerEnvironment();
  const authorization = request.headers.get("authorization");
  const cronSecret = request.headers.get("x-cron-secret");
  return Boolean(
    environment.CHANNEL_SYNC_PROCESSOR_SECRET &&
    (authorization === `Bearer ${environment.CHANNEL_SYNC_PROCESSOR_SECRET}` ||
      cronSecret === environment.CHANNEL_SYNC_PROCESSOR_SECRET)
  );
}

async function runPoll(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ message: "No autorizado." }, { status: 401 });
  }
  const outcomes = await pollAllActiveConnections();
  return Response.json({ outcomes });
}

export async function POST(request: Request) {
  return runPoll(request);
}

export async function GET(request: Request) {
  return runPoll(request);
}
