"use server";

import { requireAdministrator } from "@/infrastructure/auth/authorization";

import { getAssistantThreadStore } from "./threads";

export async function listAssistantThreadsAction() {
  const session = await requireAdministrator();
  const store = getAssistantThreadStore();
  if (!store) return [];
  return store.listThreads(session.user.id);
}

export async function getAssistantThreadAction(threadId: string) {
  const session = await requireAdministrator();
  const store = getAssistantThreadStore();
  if (!store) return null;
  return store.getThread(threadId, session.user.id);
}
