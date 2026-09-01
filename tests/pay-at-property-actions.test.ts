import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdministrator: vi.fn(),
  getService: vi.fn(),
  collect: vi.fn(),
}));
vi.mock("@/infrastructure/auth/authorization", () => ({
  requireAdministrator: mocks.requireAdministrator,
}));
vi.mock("@/features/payments/pay-at-property-collection", () => ({
  getPayAtPropertyCollectionService: mocks.getService,
}));
import { collectPayAtPropertyAction } from "@/features/payments/actions";

describe("pay at property collection action", () => {
  it("does not collect without an administrator", async () => {
    mocks.requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));
    await expect(collectPayAtPropertyAction(new FormData())).rejects.toThrow();
    expect(mocks.collect).not.toHaveBeenCalled();
  });
  it("forwards normalized values with trusted actor", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.getService.mockReturnValue({ collect: mocks.collect });
    const data = new FormData();
    data.set("reservationId", "r1");
    data.set("amountClp", "120000");
    data.set("collectedOn", "2032-01-01");
    data.set("medium", "cash");
    await collectPayAtPropertyAction(data);
    expect(mocks.collect).toHaveBeenCalledWith(
      {
        reservationId: "r1",
        amountClp: 120000,
        collectedOn: "2032-01-01",
        medium: "cash",
      },
      "admin-1"
    );
  });
});
