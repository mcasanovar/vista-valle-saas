import "server-only";

import { getServerEnvironment } from "@/config/server";
import { queryProductionRooms } from "@/infrastructure/database/room-source";
import { mockDemoRooms } from "./mock-fixtures";
import { createRoomReadSource } from "./read-model";

export async function getRoomReadSource() {
  const context = getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT;
  const records =
    context === "mock" ? mockDemoRooms : await queryProductionRooms();
  return createRoomReadSource(context, records);
}
