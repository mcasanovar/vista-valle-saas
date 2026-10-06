import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdministrator } = vi.hoisted(() => ({
  requireAdministrator: vi.fn(),
}));

vi.mock("@/infrastructure/auth/authorization", () => ({
  requireAdministrator,
}));

import {
  getAdminCompanyQuotationDetail,
  listAdminCompanyQuotations,
} from "@/infrastructure/database/admin-company-quotation-source";

/** Any call reaching the database would fail this test loudly. */
const unusableDatabase = new Proxy(
  {},
  {
    get() {
      throw new Error("Database was queried without administrative authorization");
    },
  }
) as never;

describe("admin company quotation source authorization", () => {
  beforeEach(() => {
    requireAdministrator.mockReset();
  });

  it("rejects the listing without administrative authorization, before touching the database", async () => {
    requireAdministrator.mockRejectedValueOnce(
      new Error("Administrative authorization failed: missing_session")
    );

    await expect(
      listAdminCompanyQuotations(unusableDatabase, { page: 1 })
    ).rejects.toThrow("Administrative authorization failed");
    expect(requireAdministrator).toHaveBeenCalledOnce();
  });

  it("rejects the detail without administrative authorization, before touching the database", async () => {
    requireAdministrator.mockRejectedValueOnce(
      new Error("Administrative authorization failed: not_allowed")
    );

    await expect(
      getAdminCompanyQuotationDetail(
        unusableDatabase,
        "00000000-0000-0000-0000-000000000000"
      )
    ).rejects.toThrow("Administrative authorization failed");
    expect(requireAdministrator).toHaveBeenCalledOnce();
  });
});
