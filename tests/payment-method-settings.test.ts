import { describe, expect, it } from "vitest";

import {
  createMockPaymentMethodSettingsRepository,
  normalizePaymentMethodSettingsInput,
  PaymentMethodSettingsInputError,
} from "@/features/payments";

describe("payment method settings", () => {
  it("defaults all three methods to enabled before any edit", async () => {
    const repository = createMockPaymentMethodSettingsRepository();
    await expect(repository.get()).resolves.toEqual({
      payAtPropertyEnabled: true,
      payOnlineEnabled: true,
      payByCardEnabled: true,
    });
  });

  it("persists an update and reflects it on the next read", async () => {
    const repository = createMockPaymentMethodSettingsRepository();
    await repository.update({
      payAtPropertyEnabled: true,
      payOnlineEnabled: false,
      payByCardEnabled: true,
    });
    await expect(repository.get()).resolves.toEqual({
      payAtPropertyEnabled: true,
      payOnlineEnabled: false,
      payByCardEnabled: true,
    });
  });

  it("allows persisting all three methods disabled", async () => {
    const repository = createMockPaymentMethodSettingsRepository();
    await expect(
      repository.update({
        payAtPropertyEnabled: false,
        payOnlineEnabled: false,
        payByCardEnabled: false,
      })
    ).resolves.toEqual({
      payAtPropertyEnabled: false,
      payOnlineEnabled: false,
      payByCardEnabled: false,
    });
  });

  it("normalizes valid boolean input", () => {
    expect(
      normalizePaymentMethodSettingsInput({
        payAtPropertyEnabled: false,
        payOnlineEnabled: true,
        payByCardEnabled: false,
      })
    ).toEqual({
      payAtPropertyEnabled: false,
      payOnlineEnabled: true,
      payByCardEnabled: false,
    });
  });

  it("rejects non-boolean or missing fields", () => {
    expect(() =>
      normalizePaymentMethodSettingsInput({ payAtPropertyEnabled: "yes" })
    ).toThrow(PaymentMethodSettingsInputError);
    expect(() => normalizePaymentMethodSettingsInput(null)).toThrow(
      PaymentMethodSettingsInputError
    );
  });

  it("rejects input missing payByCardEnabled", () => {
    expect(() =>
      normalizePaymentMethodSettingsInput({
        payAtPropertyEnabled: true,
        payOnlineEnabled: true,
      })
    ).toThrow(PaymentMethodSettingsInputError);
  });
});
