import { getServerEnvironment } from "@/config/server";
import { getServerScheduledOutboxProcessor } from "@/infrastructure/database/notification-processor-source";

export const dynamic = "force-dynamic";

async function processOutbox(request: Request) {
  const environment = getServerEnvironment();
  const authorization = request.headers.get("authorization");
  if (
    !environment.OUTBOX_PROCESSOR_SECRET ||
    authorization !== `Bearer ${environment.OUTBOX_PROCESSOR_SECRET}`
  ) {
    return Response.json({ message: "No autorizado." }, { status: 401 });
  }

  const processor = getServerScheduledOutboxProcessor();
  if (!processor) {
    return Response.json(
      { message: "Procesador no disponible." },
      { status: 503 }
    );
  }

  return Response.json(await processor.run());
}

export const GET = processOutbox;
export const POST = processOutbox;
