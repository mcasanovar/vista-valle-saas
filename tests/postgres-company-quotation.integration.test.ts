import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import {
  calculateCompanyQuotation,
  normalizeCompanyQuotationInput,
} from "@/features/company-quotations";
import type { NotificationOutboxWriter } from "@/features/notifications";
import { mockDemoRooms } from "@/features/rooms";
import { createDrizzleCompanyQuotationCreationService } from "@/infrastructure/database/company-quotation-repository";
import { createDrizzleNotificationOutboxWriter } from "@/infrastructure/database/notification-outbox-repository";
import { createProductionNotificationTemplateDataSource } from "@/infrastructure/database/notification-template-data-source";
import {
  renderCompanyQuotationAdminEmail,
  renderCompanyQuotationCustomerEmail,
} from "@/features/notifications/email-template-renderer";
import type { ProductionDatabaseTransaction } from "@/infrastructure/database/client";
import * as schema from "@/persistence/schema";
import {
  companyQuotationLines,
  companyQuotations,
  notificationOutbox,
} from "@/persistence/schema";

const integrationUrl = process.env.VISTA_VALLE_POSTGRES_INTEGRATION_URL;
const enabled =
  process.env.POSTGRES_RESERVATION_INTEGRATION_ENABLED === "true" &&
  typeof integrationUrl === "string";

const quotation = calculateCompanyQuotation(
  normalizeCompanyQuotationInput({
    breakfastRequested: false,
    checkIn: "2032-01-10",
    checkOut: "2032-01-12",
    company: "Integration SpA",
    contact: "Ana Prueba",
    email: "quotation-integration@example.test",
    guestCount: 2,
    message: "Integration test",
    requireParking: false,
    rooms: [{ quantity: 2, slug: "habitacion-valle-demo" }],
  }),
  mockDemoRooms
);

function quotationIdFromPayload(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const quotationId = (payload as Record<string, unknown>).quotationId;
  return typeof quotationId === "string" ? quotationId : undefined;
}

if (!enabled) {
  describe.skip("PostgreSQL company quotation integration", () => {
    it("requires the explicit integration runner", () => {});
  });
} else {
  describe("PostgreSQL company quotation integration", () => {
    const sql = postgres(integrationUrl!, { max: 2 });
    const db = drizzle(sql, { schema });

    afterAll(async () => {
      await sql.end({ timeout: 5 });
    });

    it("persists quotation snapshots and both intents atomically and idempotently", async () => {
      const service = createDrizzleCompanyQuotationCreationService(
        db,
        createDrizzleNotificationOutboxWriter("admin@example.test")
      );

      const first = await service.create(quotation, "quote-integration-1");
      const repeated = await service.create(quotation, "quote-integration-1");

      expect(repeated.id).toBe(first.id);
      expect(
        await db
          .select()
          .from(companyQuotationLines)
          .where(eq(companyQuotationLines.quotationId, first.id))
      ).toHaveLength(1);
      const intents = await db
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.quotationId, first.id));
      expect(intents).toHaveLength(2);
      expect(
        intents.every(
          (intent) => quotationIdFromPayload(intent.payload) === first.id
        )
      ).toBe(true);
    });

    it("lets the worker rebuild the full email template data from Postgres using only the quotation id", async () => {
      const service = createDrizzleCompanyQuotationCreationService(
        db,
        createDrizzleNotificationOutboxWriter("admin@example.test")
      );
      const created = await service.create(
        quotation,
        "quote-integration-worker-read"
      );

      const dataSource = createProductionNotificationTemplateDataSource(db);
      const emailData = await dataSource.getCompanyQuotationEmailData!(
        created.id
      );

      expect(emailData).toMatchObject({
        capacity: created.capacity,
        company: created.company,
        contact: created.contact,
        email: created.email,
        id: created.id,
        requireParking: created.requireParking,
        totalClp: created.totalClp,
      });
      expect(emailData!.lines).toHaveLength(1);

      const customerHtml = renderCompanyQuotationCustomerEmail(emailData!);
      const adminHtml = renderCompanyQuotationAdminEmail(emailData!);
      expect(customerHtml).toContain("Ana Prueba");
      expect(adminHtml).toContain("Integration SpA");

      await expect(
        dataSource.getCompanyQuotationEmailData!(
          "00000000-0000-0000-0000-000000000000"
        )
      ).resolves.toBeNull();
    });

    it("rolls back quotation, snapshots, and intents when outbox persistence fails", async () => {
      const failingWriter: NotificationOutboxWriter<ProductionDatabaseTransaction> =
        {
          writeCompanyQuotationRequested: async () => {
            throw new Error("outbox write failed");
          },
          writePaymentCollected: async () => undefined,
          writeReservationConfirmed: async () => undefined,
        };
      const service = createDrizzleCompanyQuotationCreationService(
        db,
        failingWriter
      );

      await expect(
        service.create(quotation, "quote-integration-rollback")
      ).rejects.toThrow("outbox write failed");
      expect(
        await db
          .select()
          .from(companyQuotations)
          .where(
            eq(companyQuotations.idempotencyKey, "quote-integration-rollback")
          )
      ).toEqual([]);
      expect(
        await db
          .select()
          .from(notificationOutbox)
          .where(
            eq(
              notificationOutbox.idempotencyKey,
              "company-quotation:quote-integration-rollback:customer"
            )
          )
      ).toEqual([]);
    });
  });
}
