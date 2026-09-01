import "server-only";
import { getServerEnvironment } from "@/config/server";
import { getChannelConnections } from "@/features/channel-calendar-sync";
export type ChannelSyncTask = Readonly<{
  id: string;
  reservationId: string;
  platform: "airbnb" | "booking";
  status: "pending" | "completed";
  completedBy?: string;
  completedAt?: Date;
}>;
const channelSyncTasksKey = Symbol.for("vista-valle.mock.channel-sync-tasks");

function getTasks(): ChannelSyncTask[] {
  const scope = globalThis as typeof globalThis & {
    [key: symbol]: ChannelSyncTask[] | undefined;
  };
  return (scope[channelSyncTasksKey] ??= []);
}

/**
 * A platform is skipped when every room in the reservation already has an
 * `enabled` `channel_connections` row for it — that platform blocks its own
 * dates automatically via the outbound iCal feed, so the manual task would
 * be redundant (see `channel-calendar-sync` spec: "La cola manual no
 * duplica una conexión activa"). If even one room lacks an active
 * connection for that platform, the task is still created.
 */
function platformNeedsManualTask(
  platform: "airbnb" | "booking",
  roomIds: readonly string[]
) {
  if (roomIds.length === 0) return true;
  const connections = getChannelConnections();
  if (!connections) return true;
  return !roomIds.every(
    (roomId) => connections.getByRoomAndPlatform(roomId, platform)?.enabled
  );
}

export function createWebsiteChannelSyncTasks(
  reservationId: string,
  roomIds: readonly string[] = []
) {
  if (getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT !== "mock") return [];
  const tasks = getTasks();
  if (tasks.some((x) => x.reservationId === reservationId))
    return tasks.filter((x) => x.reservationId === reservationId);
  const created = (["airbnb", "booking"] as const)
    .filter((platform) => platformNeedsManualTask(platform, roomIds))
    .map((platform) =>
      Object.freeze({
        id: crypto.randomUUID(),
        reservationId,
        platform,
        status: "pending" as const,
      })
    );
  tasks.push(...created);
  return created;
}
export function getChannelSyncTasks() {
  if (getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT !== "mock") return null;
  const tasks = getTasks();
  return {
    pending: () => tasks.filter((x) => x.status === "pending"),
    complete: (id: string, actor: string) => {
      const current = tasks.find((x) => x.id === id);
      if (!current || current.status !== "pending")
        throw new Error("Task unavailable");
      const next = Object.freeze({
        ...current,
        status: "completed" as const,
        completedBy: actor,
        completedAt: new Date(),
      });
      tasks.splice(tasks.indexOf(current), 1, next);
      return next;
    },
  };
}
