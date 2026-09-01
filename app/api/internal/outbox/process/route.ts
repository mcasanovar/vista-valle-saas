import { getServerEnvironment } from "@/config/server";
import { getScheduledOutboxProcessor } from "@/features/notifications/scheduled-processor";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const environment = getServerEnvironment();
  const authorization = request.headers.get("authorization");
  if (
    !environment.OUTBOX_PROCESSOR_SECRET ||
    authorization !== `Bearer ${environment.OUTBOX_PROCESSOR_SECRET}`
  ) {
    return Response.json({ message: "No autorizado." }, { status: 401 });
  }

  const processor = getScheduledOutboxProcessor();
  if (!processor) {
    return Response.json(
      { message: "Procesador no disponible." },
      { status: 503 }
    );
  }

  return Response.json(await processor.run());
}
