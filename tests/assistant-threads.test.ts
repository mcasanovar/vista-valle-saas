import { describe, expect, it } from "vitest";

import {
  AssistantThreadNotFoundError,
  getAssistantThreadStore,
} from "@/features/assistant/threads";

function store() {
  const instance = getAssistantThreadStore();
  if (!instance) throw new Error("Mock thread store is required for this test");
  return instance;
}

describe("assistant thread persistence and isolation (task 7.3)", () => {
  it("persists messages and returns them in order on retrieval", async () => {
    const threads = store();
    const thread = await threads.createThread("admin-a", "Bloqueos de enero");

    await threads.appendMessages(thread.id, "admin-a", [
      { content: "Bloquea la habitación Andes", role: "user" },
      { content: "Listo, ¿confirmas?", role: "assistant" },
    ]);

    const retrieved = await threads.getThread(thread.id, "admin-a");
    expect(retrieved).not.toBeNull();
    expect(retrieved!.messages.map((m) => m.content)).toEqual([
      "Bloquea la habitación Andes",
      "Listo, ¿confirmas?",
    ]);
  });

  it("does not let an administrator read another administrator's thread", async () => {
    const threads = store();
    const thread = await threads.createThread("admin-a", "Privado de A");
    await threads.appendMessages(thread.id, "admin-a", [
      { content: "Secreto de A", role: "user" },
    ]);

    const asOtherAdmin = await threads.getThread(thread.id, "admin-b");
    expect(asOtherAdmin).toBeNull();
  });

  it("does not let an administrator append messages to another's thread", async () => {
    const threads = store();
    const thread = await threads.createThread("admin-a");

    await expect(
      threads.appendMessages(thread.id, "admin-b", [
        { content: "intento ajeno", role: "user" },
      ])
    ).rejects.toBeInstanceOf(AssistantThreadNotFoundError);

    const stillOwnedByA = await threads.getThread(thread.id, "admin-a");
    expect(stillOwnedByA!.messages).toHaveLength(0);
  });

  it("lists only the calling administrator's own threads", async () => {
    const threads = store();
    await threads.createThread("admin-list-a", "A1");
    await threads.createThread("admin-list-a", "A2");
    await threads.createThread("admin-list-b", "B1");

    const listA = await threads.listThreads("admin-list-a");
    const listB = await threads.listThreads("admin-list-b");

    expect(listA.map((t) => t.title).sort()).toEqual(["A1", "A2"]);
    expect(listB.map((t) => t.title)).toEqual(["B1"]);
  });
});
