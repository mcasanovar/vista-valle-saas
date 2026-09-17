"use server";

import { requireAdministrator } from "@/infrastructure/auth/authorization";

import { getAssistantMemoryStore } from "./memory";

export async function listAssistantMemoryFactsAction() {
  const session = await requireAdministrator();
  const store = getAssistantMemoryStore();
  if (!store) return [];
  return store.listFacts(session.user.id);
}

export async function updateAssistantMemoryFactAction(id: string, fact: string) {
  const session = await requireAdministrator();
  const store = getAssistantMemoryStore();
  if (!store) throw new Error("Assistant memory unavailable");
  return store.updateFact(id, session.user.id, fact);
}

export async function deleteAssistantMemoryFactAction(id: string) {
  const session = await requireAdministrator();
  const store = getAssistantMemoryStore();
  if (!store) throw new Error("Assistant memory unavailable");
  await store.deleteFact(id, session.user.id);
}
