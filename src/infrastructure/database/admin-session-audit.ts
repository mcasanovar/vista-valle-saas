import "server-only";

import { auditEvents } from "@/persistence/schema";
import type { ProductionDatabase } from "./client";

export type AdminSessionAuditAction =
  | "admin_session.login_failed"
  | "admin_session.login_succeeded"
  | "admin_session.logout";

/**
 * Persists a login success, login failure, or logout as an auditable event
 * (harden-admin-authentication, task 5.5): `entityType: "admin_session"`,
 * `entityId` the authenticated user's id when known (null for a failed
 * login before identity verification — see the nullable column migration
 * `drizzle/0019_last_justice.sql`). Never receives the password or any
 * token; `actorUserId` is the only identity carried.
 */
export async function recordAdminSessionAuditEvent(
  db: ProductionDatabase,
  action: AdminSessionAuditAction,
  actorUserId: string | null
): Promise<void> {
  await db.insert(auditEvents).values({
    action,
    actorUserId,
    entityId: actorUserId,
    entityType: "admin_session",
  });
}
