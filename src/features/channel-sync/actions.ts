"use server";

import { revalidatePath } from "next/cache";
import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { getChannelSyncTasks } from "./tasks";

export async function completeChannelSyncTaskAction(data: FormData) {
  const user = await requireAdministrator();
  const service = getChannelSyncTasks();
  if (!service) throw new Error("Channel sync unavailable");
  const task = service.complete(String(data.get("id") ?? ""), user.user.id);
  revalidatePath("/admin");
  return task;
}
