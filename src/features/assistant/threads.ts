import "server-only";

import { and, asc, desc, eq } from "drizzle-orm";

import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { getServerEnvironment } from "@/config/server";
import { assistantMessages, assistantThreads } from "@/persistence/schema";
import type { ProductionDatabase } from "@/infrastructure/database/client";

export type AssistantThreadRole = "assistant" | "user";

export type AssistantThreadSummary = Readonly<{
  createdAt: Date;
  id: string;
  title: string | null;
  updatedAt: Date;
}>;

export type AssistantThreadMessage = Readonly<{
  content: string;
  createdAt: Date;
  id: string;
  role: AssistantThreadRole;
  toolActivity?: unknown;
}>;

export type AssistantThreadWithMessages = AssistantThreadSummary &
  Readonly<{ messages: readonly AssistantThreadMessage[] }>;

export type AssistantThreadMessageInput = Readonly<{
  content: string;
  role: AssistantThreadRole;
  toolActivity?: unknown;
}>;

/**
 * Persists and retrieves conversation threads, scoped to the
 * administrator who owns them (proposal.md "La conversación persiste
 * entre sesiones: el administrador puede retomar un hilo o abrir uno
 * nuevo" — never another administrator's). `getThread` and
 * `appendMessages` both check ownership and return/throw as if the thread
 * didn't exist, rather than leaking that a hilo belonging to someone else
 * exists.
 */
export type AssistantThreadStore = Readonly<{
  appendMessages: (
    threadId: string,
    adminUserId: string,
    messages: readonly AssistantThreadMessageInput[]
  ) => Promise<void>;
  createThread: (
    adminUserId: string,
    title?: string
  ) => Promise<AssistantThreadSummary>;
  getThread: (
    threadId: string,
    adminUserId: string
  ) => Promise<AssistantThreadWithMessages | null>;
  listThreads: (adminUserId: string) => Promise<readonly AssistantThreadSummary[]>;
}>;

export class AssistantThreadNotFoundError extends Error {
  constructor() {
    super("Assistant thread not found");
    this.name = "AssistantThreadNotFoundError";
  }
}

function createDrizzleAssistantThreadStore(
  db: ProductionDatabase
): AssistantThreadStore {
  async function findOwnedThread(threadId: string, adminUserId: string) {
    const [row] = await db
      .select()
      .from(assistantThreads)
      .where(
        and(
          eq(assistantThreads.id, threadId),
          eq(assistantThreads.adminUserId, adminUserId)
        )
      );
    return row ?? null;
  }

  return Object.freeze({
    async appendMessages(threadId, adminUserId, messages) {
      const thread = await findOwnedThread(threadId, adminUserId);
      if (!thread) throw new AssistantThreadNotFoundError();
      if (messages.length === 0) return;
      await db.insert(assistantMessages).values(
        messages.map((message) => ({
          content: message.content,
          role: message.role,
          threadId,
          toolActivity: message.toolActivity ?? null,
        }))
      );
      await db
        .update(assistantThreads)
        .set({ updatedAt: new Date() })
        .where(eq(assistantThreads.id, threadId));
    },
    async createThread(adminUserId, title) {
      const [row] = await db
        .insert(assistantThreads)
        .values({ adminUserId, title: title ?? null })
        .returning();
      return row!;
    },
    async getThread(threadId, adminUserId) {
      const thread = await findOwnedThread(threadId, adminUserId);
      if (!thread) return null;
      const messages = await db
        .select()
        .from(assistantMessages)
        .where(eq(assistantMessages.threadId, threadId))
        .orderBy(asc(assistantMessages.createdAt));
      return Object.freeze({ ...thread, messages: Object.freeze(messages) });
    },
    async listThreads(adminUserId) {
      const rows = await db
        .select()
        .from(assistantThreads)
        .where(eq(assistantThreads.adminUserId, adminUserId))
        .orderBy(desc(assistantThreads.updatedAt));
      return Object.freeze(rows);
    },
  });
}

type MockStoredThread = {
  adminUserId: string;
  createdAt: Date;
  id: string;
  messages: (AssistantThreadMessage & { threadId: string })[];
  title: string | null;
  updatedAt: Date;
};

const mockThreadsKey = Symbol.for("vista-valle.mock.assistant-threads");

function getMockThreads() {
  const scope = globalThis as typeof globalThis & {
    [key: symbol]: MockStoredThread[] | undefined;
  };
  return (scope[mockThreadsKey] ??= []);
}

function createMockAssistantThreadStore(): AssistantThreadStore {
  return Object.freeze({
    async appendMessages(threadId, adminUserId, messages) {
      const thread = getMockThreads().find(
        (candidate) =>
          candidate.id === threadId && candidate.adminUserId === adminUserId
      );
      if (!thread) throw new AssistantThreadNotFoundError();
      const now = new Date();
      thread.messages.push(
        ...messages.map((message) => ({
          content: message.content,
          createdAt: now,
          id: crypto.randomUUID(),
          role: message.role,
          threadId,
          toolActivity: message.toolActivity,
        }))
      );
      thread.updatedAt = now;
    },
    async createThread(adminUserId, title) {
      const now = new Date();
      const thread: MockStoredThread = {
        adminUserId,
        createdAt: now,
        id: crypto.randomUUID(),
        messages: [],
        title: title ?? null,
        updatedAt: now,
      };
      getMockThreads().push(thread);
      return Object.freeze({
        createdAt: thread.createdAt,
        id: thread.id,
        title: thread.title,
        updatedAt: thread.updatedAt,
      });
    },
    async getThread(threadId, adminUserId) {
      const thread = getMockThreads().find(
        (candidate) =>
          candidate.id === threadId && candidate.adminUserId === adminUserId
      );
      if (!thread) return null;
      return Object.freeze({
        createdAt: thread.createdAt,
        id: thread.id,
        messages: Object.freeze(
          thread.messages.map((message) => Object.freeze({ ...message }))
        ),
        title: thread.title,
        updatedAt: thread.updatedAt,
      });
    },
    async listThreads(adminUserId) {
      return Object.freeze(
        getMockThreads()
          .filter((thread) => thread.adminUserId === adminUserId)
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
          .map((thread) =>
            Object.freeze({
              createdAt: thread.createdAt,
              id: thread.id,
              title: thread.title,
              updatedAt: thread.updatedAt,
            })
          )
      );
    },
  });
}

export function getAssistantThreadStore(): AssistantThreadStore | null {
  const boundary = createDatabaseBoundary();
  if (boundary.context === "production") {
    return createDrizzleAssistantThreadStore(createProductionDatabase(boundary));
  }
  if (getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT !== "mock") return null;
  return createMockAssistantThreadStore();
}
