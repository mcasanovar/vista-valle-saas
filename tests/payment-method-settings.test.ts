import { describe, expect, it } from "vitest";

import {
  createMockPaymentMethodSettingsRepository,
  normalizePaymentMethodSettingsInput,
  PaymentMethodSettingsInputError,
} from "@/features/payments";

describe("payment method settings", () => {
  it("defaults both methods to enabled before any edit", async () => {
    const repository = createMockPaymentMethodSettingsRepository();
    await expect(repository.get()).resolves.toEqual({
      payAtPropertyEnabled: true,
      payOnlineEnabled: true,
    });
  });

  it("persists an update and reflects it on the next read", async () => {
    const repository = createMockPaymentMethodSettingsRepository();
    await repository.update({
      payAtPropertyEnabled: true,
      payOnlineEnabled: false,
    });
    await expect(repository.get()).resolves.toEqual({
      payAtPropertyEnabled: true,
      payOnlineEnabled: false,
    });
  });

  it("allows persisting both methods disabled", async () => {
    const repository = createMockPaymentMethodSettingsRepository();
    await expect(
      repository.update({
        payAtPropertyEnabled: false,
        payOnlineEnabled: false,
      })
    ).resolves.toEqual({
      payAtPropertyEnabled: false,
      payOnlineEnabled: false,
    });
  });

  it("normalizes valid boolean input", () => {
    expect(
      normalizePaymentMethodSettingsInput({
        payAtPropertyEnabled: false,
        payOnlineEnabled: true,
      })
    ).toEqual({ payAtPropertyEnabled: false, payOnlineEnabled: true });
  });

  it("rejects non-boolean or missing fields", () => {
    expect(() =>
      normalizePaymentMethodSettingsInput({ payAtPropertyEnabled: "yes" })
    ).toThrow(PaymentMethodSettingsInputError);
    expect(() => normalizePaymentMethodSettingsInput(null)).toThrow(
      PaymentMethodSettingsInputError
    );
  });
});
