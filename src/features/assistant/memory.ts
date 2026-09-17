import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { getServerEnvironment } from "@/config/server";
import { assistantMemoryFacts } from "@/persistence/schema";
import type { ProductionDatabase } from "@/infrastructure/database/client";

export type AssistantMemoryFact = Readonly<{
  createdAt: Date;
  fact: string;
  id: string;
  updatedAt: Date;
}>;

export class AssistantMemoryFactNotFoundError extends Error {
  constructor() {
    super("Assistant memory fact not found");
    this.name = "AssistantMemoryFactNotFoundError";
  }
}

/**
 * The administrator's taught facts (proposal.md "Memoria de
 * preferencias"), scoped per administrator. Every write here is a direct
 * mutation with no confirmation step — the fact is immediately visible,
 * editable, and deletable from the memory view (task 10.3), which is the
 * correction mechanism instead of a propose/confirm cycle.
 */
export type AssistantMemoryStore = Readonly<{
  createFact: (adminUserId: string, fact: string) => Promise<AssistantMemoryFact>;
  deleteFact: (id: string, adminUserId: string) => Promise<void>;
  listFacts: (adminUserId: string) => Promise<readonly AssistantMemoryFact[]>;
  updateFact: (
    id: string,
    adminUserId: string,
    fact: string
  ) => Promise<AssistantMemoryFact>;
}>;

function createDrizzleAssistantMemoryStore(
  db: ProductionDatabase
): AssistantMemoryStore {
  async function findOwned(id: string, adminUserId: string) {
    const [row] = await db
      .select()
      .from(assistantMemoryFacts)
      .where(
        and(
          eq(assistantMemoryFacts.id, id),
          eq(assistantMemoryFacts.adminUserId, adminUserId)
        )
      );
    return row ?? null;
  }

  return Object.freeze({
    async createFact(adminUserId, fact) {
      const [row] = await db
        .insert(assistantMemoryFacts)
        .values({ adminUserId, fact })
        .returning();
      return row!;
    },
    async deleteFact(id, adminUserId) {
      const existing = await findOwned(id, adminUserId);
      if (!existing) throw new AssistantMemoryFactNotFoundError();
      await db.delete(assistantMemoryFacts).where(eq(assistantMemoryFacts.id, id));
    },
    async listFacts(adminUserId) {
      const rows = await db
        .select()
        .from(assistantMemoryFacts)
        .where(eq(assistantMemoryFacts.adminUserId, adminUserId))
        .orderBy(desc(assistantMemoryFacts.createdAt));
      return Object.freeze(rows);
    },
    async updateFact(id, adminUserId, fact) {
      const existing = await findOwned(id, adminUserId);
      if (!existing) throw new AssistantMemoryFactNotFoundError();
      const [row] = await db
        .update(assistantMemoryFacts)
        .set({ fact, updatedAt: new Date() })
        .where(eq(assistantMemoryFacts.id, id))
        .returning();
      return row!;
    },
  });
}

type MockStoredFact = {
  adminUserId: string;
  createdAt: Date;
  fact: string;
  id: string;
  updatedAt: Date;
};

const mockFactsKey = Symbol.for("vista-valle.mock.assistant-memory-facts");

function getMockFacts() {
  const scope = globalThis as typeof globalThis & {
    [key: symbol]: MockStoredFact[] | undefined;
  };
  return (scope[mockFactsKey] ??= []);
}

function createMockAssistantMemoryStore(): AssistantMemoryStore {
  return Object.freeze({
    async createFact(adminUserId, fact) {
      const now = new Date();
      const created: MockStoredFact = {
        adminUserId,
        createdAt: now,
        fact,
        id: crypto.randomUUID(),
        updatedAt: now,
      };
      getMockFacts().push(created);
      return created;
    },
    async deleteFact(id, adminUserId) {
      const facts = getMockFacts();
      const index = facts.findIndex(
        (fact) => fact.id === id && fact.adminUserId === adminUserId
      );
      if (index === -1) throw new AssistantMemoryFactNotFoundError();
      facts.splice(index, 1);
    },
    async listFacts(adminUserId) {
      return Object.freeze(
        getMockFacts()
          .filter((fact) => fact.adminUserId === adminUserId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((fact) => Object.freeze({ ...fact }))
      );
    },
    async updateFact(id, adminUserId, fact) {
      const existing = getMockFacts().find(
        (candidate) => candidate.id === id && candidate.adminUserId === adminUserId
      );
      if (!existing) throw new AssistantMemoryFactNotFoundError();
      existing.fact = fact;
      existing.updatedAt = new Date();
      return Object.freeze({ ...existing });
    },
  });
}

export function getAssistantMemoryStore(): AssistantMemoryStore | null {
  const boundary = createDatabaseBoundary();
  if (boundary.context === "production") {
    return createDrizzleAssistantMemoryStore(createProductionDatabase(boundary));
  }
  if (getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT !== "mock") return null;
  return createMockAssistantMemoryStore();
}
