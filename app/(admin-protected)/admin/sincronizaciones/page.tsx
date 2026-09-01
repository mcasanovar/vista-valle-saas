import { getServerEnvironment } from "@/config/server";
import { getRoomReadSource } from "@/features/rooms";
import { completeChannelSyncTaskAction } from "@/features/channel-sync/actions";
import { ChannelSyncChecklist } from "@/features/channel-sync/checklist";
import { getChannelSyncTasks } from "@/features/channel-sync/tasks";
import {
  regenerateChannelConnectionTokenAction,
  saveChannelConnectionAction,
} from "@/features/channel-calendar-sync/actions";
import { getChannelConnections } from "@/features/channel-calendar-sync/connections";
import {
  ChannelConnectionsPanel,
  type RoomConnectionCards,
} from "@/features/channel-calendar-sync/connections-panel";

const PLATFORMS = ["airbnb", "booking"] as const;

export default async function SyncPage({
  searchParams,
}: Readonly<{ searchParams: Promise<{ tab?: string }> }>) {
  const { tab } = await searchParams;
  const activeTab = tab === "conexiones" ? "conexiones" : "cola";

  const tasks = getChannelSyncTasks()?.pending() ?? [];
  const rooms = (await getRoomReadSource()).listActive();
  const connections = getChannelConnections();
  const siteUrl = getServerEnvironment().SITE_URL;

  const roomCards: readonly RoomConnectionCards[] = rooms.map((room) => ({
    roomId: room.id,
    roomName: room.name,
    cards: PLATFORMS.map((platform) => {
      const connection =
        connections?.getByRoomAndPlatform(room.id, platform) ?? null;
      return {
        roomId: room.id,
        platform,
        connection: connection
          ? {
              id: connection.id,
              outboundToken: connection.outboundToken,
              paymentBehavior: connection.paymentBehavior,
              lastPolledAt: connection.lastPolledAt,
              lastPollStatus: connection.lastPollStatus,
              lastPollEventCount: connection.lastPollEventCount,
              lastPollError: connection.lastPollError,
            }
          : null,
        outboundUrl: connection
          ? `${siteUrl}/api/ical/${connection.outboundToken}`
          : null,
      };
    }),
  }));

  return (
    <section aria-labelledby="sincronizaciones-page-title">
      <h1 id="sincronizaciones-page-title">Sincronizaciones</h1>
      <nav aria-label="Pestañas de sincronización" className="mt-4 flex gap-2 border-b border-border">
        <a
          href="?tab=cola"
          aria-current={activeTab === "cola" ? "page" : undefined}
          className={`min-h-11 px-4 py-2 text-sm font-semibold ${
            activeTab === "cola"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground"
          }`}
        >
          Cola manual
        </a>
        <a
          href="?tab=conexiones"
          aria-current={activeTab === "conexiones" ? "page" : undefined}
          className={`min-h-11 px-4 py-2 text-sm font-semibold ${
            activeTab === "conexiones"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground"
          }`}
        >
          Conexiones de canal
        </a>
      </nav>
      <div className="mt-4">
        {activeTab === "cola" ? (
          <ChannelSyncChecklist
            tasks={tasks}
            complete={completeChannelSyncTaskAction}
          />
        ) : (
          <ChannelConnectionsPanel
            rooms={roomCards}
            save={saveChannelConnectionAction}
            regenerate={regenerateChannelConnectionTokenAction}
          />
        )}
      </div>
    </section>
  );
}
