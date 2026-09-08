import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAdminDashboardSummary, requireAdministrator } = vi.hoisted(() => ({
  getAdminDashboardSummary: vi.fn(),
  requireAdministrator: vi.fn(),
}));

vi.mock("@/infrastructure/auth/authorization", () => ({
  requireAdministrator,
}));
vi.mock("@/features/admin/dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/admin/dashboard")>()),
  getAdminDashboardSummary,
}));

import { GET } from "../app/api/admin/dashboard/route";

describe("admin dashboard API route", () => {
  beforeEach(() => {
    requireAdministrator.mockReset();
    getAdminDashboardSummary.mockReset();
  });

  it("rejects an unauthenticated request before resolving any period", async () => {
    requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));

    const response = await GET(
      new Request("http://localhost/api/admin/dashboard")
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "No autorizado" });
    expect(getAdminDashboardSummary).not.toHaveBeenCalled();
  });

  it("resolves a whole-year summary from ?year alone", async () => {
    requireAdministrator.mockResolvedValueOnce({ user: { id: "admin-1" } });
    getAdminDashboardSummary.mockResolvedValueOnce({
      period: { month: null, year: 2025 },
    });

    const response = await GET(
      new Request("http://localhost/api/admin/dashboard?year=2025")
    );

    expect(response.status).toBe(200);
    expect(getAdminDashboardSummary).toHaveBeenCalledWith({
      month: null,
      year: 2025,
    });
    expect(await response.json()).toEqual({
      period: { month: null, year: 2025 },
    });
  });

  it("still resolves a monthly summary from ?month alone", async () => {
    requireAdministrator.mockResolvedValueOnce({ user: { id: "admin-1" } });
    getAdminDashboardSummary.mockResolvedValueOnce({
      period: { month: "2025-03", year: 2025 },
    });

    const response = await GET(
      new Request("http://localhost/api/admin/dashboard?month=2025-03")
    );

    expect(response.status).toBe(200);
    expect(getAdminDashboardSummary).toHaveBeenCalledWith({
      month: "2025-03",
      year: 2025,
    });
  });
});
