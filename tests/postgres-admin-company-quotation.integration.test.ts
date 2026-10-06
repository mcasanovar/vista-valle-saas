import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import {
  calculateCompanyQuotation,
  normalizeCompanyQuotationInput,
} from "@/features/company-quotations";
import { mockDemoRooms } from "@/features/rooms";
import {
  getAdminCompanyQuotationDetail,
  listAdminCompanyQuotations,
} from "@/infrastructure/database/admin-company-quotation-source";
import { createDrizzleCompanyQuotationCreationService } from "@/infrastructure/database/company-quotation-repository";
import { createDrizzleNotificationOutboxWriter } from "@/infrastructure/database/notification-outbox-repository";
import * as schema from "@/persistence/schema";
import { notificationOutbox } from "@/persistence/schema";

const integrationUrl = process.env.VISTA_VALLE_POSTGRES_INTEGRATION_URL;
const enabled =
  process.env.POSTGRES_RESERVATION_INTEGRATION_ENABLED === "true" &&
  typeof integrationUrl === "string";

function quotationInput(
  overrides: Partial<Parameters<typeof normalizeCompanyQuotationInput>[0]> = {}
) {
  return normalizeCompanyQuotationInput({
    breakfastRequested: false,
    checkIn: "2033-03-10",
    checkOut: "2033-03-12",
    company: "Admin View SpA",
    contact: "Ana Vista",
    email: "admin-view@example.test",
    guestCount: 2,
    message: "Mensaje de prueba",
    phone: "+56900000000",
    requireParking: false,
    rooms: [{ guestCount: 2, quantity: 2, slug: "habitacion-valle-demo" }],
    ...(overrides as Record<string, unknown>),
  });
}

if (!enabled) {
  describe.skip("PostgreSQL admin company quotation integration", () => {
    it("requires the explicit integration runner", () => {});
  });
} else {
  describe("PostgreSQL admin company quotation integration", () => {
    const sql = postgres(integrationUrl!, { max: 2 });
    const db = drizzle(sql, { schema });
    const service = createDrizzleCompanyQuotationCreationService(
      db,
      createDrizzleNotificationOutboxWriter("admin@example.test")
    );

    afterAll(async () => {
      await sql.end({ timeout: 5 });
    });

    it("paginates one row per quotation even when a quotation holds several room lines", async () => {
      const multiLine = quotationInput({
        guestCount: 3,
        rooms: [
          { guestCount: 1, quantity: 1, slug: "habitacion-valle-demo" },
          { guestCount: 2, quantity: 1, slug: "habitacion-terra-demo" },
        ],
      });
      const first = await service.create(
        calculateCompanyQuotation(multiLine, mockDemoRooms),
        "admin-view-multiline-1"
      );
      await service.create(
        calculateCompanyQuotation(multiLine, mockDemoRooms),
        "admin-view-multiline-2"
      );

      const page = await listAdminCompanyQuotations(db, {
        page: 1,
        pageSize: 1,
        search: "Admin View SpA",
      });

      expect(page.rows).toHaveLength(1);
      expect(page.total).toBeGreaterThanOrEqual(2);
      // Phase 2 still carries every room line of the paginated quotation.
      expect(page.rows[0]!.rooms.length).toBeGreaterThanOrEqual(2);
      expect(page.rows[0]!.id).toBeTruthy();
      expect(first.record.id).toBeTruthy();
    });

    it("excludes quotations that do not match each filter", async () => {
      const created = await service.create(
        calculateCompanyQuotation(
          quotationInput({
            checkIn: "2033-04-01",
            checkOut: "2033-04-03",
            company: "Filtro Único SpA",
            contact: "Carla Filtro",
            email: "filtro-unico@example.test",
            phone: "+56911111111",
          }),
          mockDemoRooms
        ),
        "admin-view-filters-1"
      );

      const matches = async (
        filter: Parameters<typeof listAdminCompanyQuotations>[1]
      ) =>
        (await listAdminCompanyQuotations(db, filter)).rows.some(
          (row) => row.id === created.record.id
        );

      await expect(matches({ page: 1, search: "Filtro Único" })).resolves.toBe(
        true
      );
      await expect(matches({ page: 1, search: "carla filtro" })).resolves.toBe(
        true
      );
      await expect(
        matches({ page: 1, search: "filtro-unico@example.test" })
      ).resolves.toBe(true);
      await expect(matches({ page: 1, search: "+56911111111" })).resolves.toBe(
        true
      );
      await expect(
        matches({ page: 1, search: "no-such-company-term" })
      ).resolves.toBe(false);

      await expect(
        matches({ checkIn: { from: "2033-04-01", to: "2033-04-01" }, page: 1 })
      ).resolves.toBe(true);
      await expect(
        matches({ checkIn: { from: "2033-05-01" }, page: 1 })
      ).resolves.toBe(false);
      await expect(
        matches({ checkOut: { from: "2033-04-03", to: "2033-04-03" }, page: 1 })
      ).resolves.toBe(true);
      await expect(
        matches({ checkOut: { to: "2033-04-02" }, page: 1 })
      ).resolves.toBe(false);

      // Freshly created intents are still pending, never delivered or failed.
      await expect(
        matches({ deliveryState: "pending", page: 1 })
      ).resolves.toBe(true);
      await expect(
        matches({ deliveryState: "delivered", page: 1 })
      ).resolves.toBe(false);
      await expect(matches({ deliveryState: "failed", page: 1 })).resolves.toBe(
        false
      );
    });

    it("derives the delivery state from the quotation's notification intents", async () => {
      const created = await service.create(
        calculateCompanyQuotation(
          quotationInput({ company: "Entrega SpA" }),
          mockDemoRooms
        ),
        "admin-view-delivery-1"
      );
      const quotationId = created.record.id;
      const deliveryStateOf = async () =>
        (
          await listAdminCompanyQuotations(db, {
            page: 1,
            search: "Entrega SpA",
          })
        ).rows.find((row) => row.id === quotationId)?.deliveryState;

      expect(await deliveryStateOf()).toBe("pending");

      await db
        .update(notificationOutbox)
        .set({ status: "delivered", deliveredAt: new Date() })
        .where(inArray(notificationOutbox.id, created.notificationOutboxIds));
      expect(await deliveryStateOf()).toBe("delivered");

      await db
        .update(notificationOutbox)
        .set({ status: "failed", lastError: "delivery_permanent" })
        .where(eq(notificationOutbox.id, created.notificationOutboxIds[1]!));
      expect(await deliveryStateOf()).toBe("failed");
      await expect(
        listAdminCompanyQuotations(db, {
          deliveryState: "failed",
          page: 1,
          search: "Entrega SpA",
        }).then((result) => result.rows.map((row) => row.id))
      ).resolves.toContain(quotationId);
    });

    it("reads a complete detail, with breakfast only when it was requested, and never exposes notification recipients", async () => {
      const withBreakfast = await service.create(
        calculateCompanyQuotation(
          quotationInput({
            breakfastQuantity: 3,
            breakfastRequested: true,
            company: "Desayuno SpA",
            guestCount: 3,
            rooms: [
              { guestCount: 1, quantity: 1, slug: "habitacion-valle-demo" },
              { guestCount: 2, quantity: 1, slug: "habitacion-terra-demo" },
            ],
          }),
          mockDemoRooms,
          { description: "Desayuno demo", unitPriceClp: 8000 }
        ),
        "admin-view-detail-breakfast"
      );
      const withoutBreakfast = await service.create(
        calculateCompanyQuotation(
          quotationInput({ company: "Sin Desayuno SpA" }),
          mockDemoRooms
        ),
        "admin-view-detail-no-breakfast"
      );

      const detail = await getAdminCompanyQuotationDetail(
        db,
        withBreakfast.record.id
      );
      expect(detail).toMatchObject({
        breakfastQuantity: 3,
        breakfastRequested: true,
        breakfastUnitPriceClp: 8000,
        company: "Desayuno SpA",
        contact: "Ana Vista",
        email: "admin-view@example.test",
        guestCount: 3,
        message: "Mensaje de prueba",
      });
      expect(detail!.lines).toHaveLength(2);
      expect(detail!.notifications).toHaveLength(2);
      expect(detail!.totalClp).toBe(withBreakfast.record.totalClp);
      expect(JSON.stringify(detail!.notifications)).not.toContain(
        "admin@example.test"
      );
      expect(JSON.stringify(detail!.notifications)).not.toContain("recipient");

      const plainDetail = await getAdminCompanyQuotationDetail(
        db,
        withoutBreakfast.record.id
      );
      expect(plainDetail).toMatchObject({
        breakfastQuantity: null,
        breakfastRequested: false,
        breakfastSubtotalClp: 0,
        breakfastUnitPriceClp: null,
      });
      expect(plainDetail!.lines).toHaveLength(1);

      await expect(
        getAdminCompanyQuotationDetail(
          db,
          "00000000-0000-0000-0000-000000000000"
        )
      ).resolves.toBeNull();
    });
  });
}
