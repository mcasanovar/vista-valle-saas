import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdministrator, createDatabaseBoundary } = vi.hoisted(() => ({
  requireAdministrator: vi.fn(),
  createDatabaseBoundary: vi.fn(),
}));

vi.mock("@/infrastructure/auth/authorization", () => ({
  requireAdministrator,
}));
vi.mock("@/infrastructure/database/server", () => ({ createDatabaseBoundary }));

import { GET, PUT } from "../app/api/admin/payment-methods/route";
import { getPaymentMethodSettingsRepository } from "@/features/payments";

describe("admin payment methods API route", () => {
  beforeEach(() => {
    requireAdministrator.mockReset();
    createDatabaseBoundary.mockReset();
    createDatabaseBoundary.mockReturnValue({ context: "mock" });
    requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    getPaymentMethodSettingsRepository("mock")!.update({
      payAtPropertyEnabled: true,
      payOnlineEnabled: true,
    });
  });

  it("rejects an unauthenticated GET without exposing the settings", async () => {
    requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));

    const response = await GET();

    expect(response.status).toBe(401);
  });

  it("rejects an unauthenticated PUT without modifying the settings", async () => {
    requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));

    const response = await PUT(
      new Request("http://localhost/api/admin/payment-methods", {
        body: JSON.stringify({
          payAtPropertyEnabled: false,
          payOnlineEnabled: false,
        }),
        method: "PUT",
      })
    );

    expect(response.status).toBe(401);
    await expect(
      getPaymentMethodSettingsRepository("mock")!.get()
    ).resolves.toEqual({ payAtPropertyEnabled: true, payOnlineEnabled: true });
  });

  it("returns the current settings for an authenticated GET", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      payAtPropertyEnabled: true,
      payOnlineEnabled: true,
    });
  });

  it("persists a valid authenticated update, including both methods disabled", async () => {
    const response = await PUT(
      new Request("http://localhost/api/admin/payment-methods", {
        body: JSON.stringify({
          payAtPropertyEnabled: false,
          payOnlineEnabled: false,
        }),
        method: "PUT",
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      payAtPropertyEnabled: false,
      payOnlineEnabled: false,
    });
    await expect(
      getPaymentMethodSettingsRepository("mock")!.get()
    ).resolves.toEqual({
      payAtPropertyEnabled: false,
      payOnlineEnabled: false,
    });
  });

  it("rejects an invalid payload without saving", async () => {
    const response = await PUT(
      new Request("http://localhost/api/admin/payment-methods", {
        body: JSON.stringify({ payAtPropertyEnabled: "no" }),
        method: "PUT",
      })
    );

    expect(response.status).toBe(400);
    await expect(
      getPaymentMethodSettingsRepository("mock")!.get()
    ).resolves.toEqual({ payAtPropertyEnabled: true, payOnlineEnabled: true });
  });
});
