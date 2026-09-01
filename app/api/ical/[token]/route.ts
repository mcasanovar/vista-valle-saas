import { getChannelConnections } from "@/features/channel-calendar-sync";
import { getMockOutboundFeedEntries } from "@/features/channel-calendar-sync/outbound-feed-source";
import { generateOutboundIcalDocument } from "@/features/channel-calendar-sync/outbound-feed";

export const dynamic = "force-dynamic";

/**
 * Publishes the outbound, read-only `.ics` feed for one channel connection.
 * The token is the sole credential (see `channel-calendar-sync` spec:
 * "Acceso sin el identificador correcto"): an unknown or mismatched token
 * returns 404 without touching any occupancy data.
 */
export async function GET(
  _request: Request,
  { params }: Readonly<{ params: Promise<{ token: string }> }>
) {
  const { token } = await params;
  const connections = getChannelConnections();
  const connection = connections?.getByOutboundToken(token);
  if (!connection) {
    return new Response("Not found.", { status: 404 });
  }

  const entries = await getMockOutboundFeedEntries(connection.roomId);
  if (!entries) {
    return new Response("Not found.", { status: 404 });
  }

  const document = generateOutboundIcalDocument(entries, connection.platform);
  return new Response(document, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="vista-valle.ics"',
      "Cache-Control": "no-store",
    },
  });
}
