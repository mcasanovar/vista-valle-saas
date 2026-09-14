import "server-only";

export type PaymentMethodSettings = Readonly<{
  payAtPropertyEnabled: boolean;
  payOnlineEnabled: boolean;
}>;

export type PaymentMethodSettingsInput = PaymentMethodSettings;

export type PaymentMethodSettingsIssue = Readonly<{
  field: string;
  message: string;
}>;

export class PaymentMethodSettingsInputError extends Error {
  readonly code = "INVALID_PAYMENT_METHOD_SETTINGS_INPUT" as const;

  constructor(readonly issues: readonly PaymentMethodSettingsIssue[]) {
    super("La configuración de métodos de pago no es válida.");
    this.name = "PaymentMethodSettingsInputError";
  }
}

export function normalizePaymentMethodSettingsInput(
  value: unknown
): PaymentMethodSettingsInput {
  const candidate =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const issues: PaymentMethodSettingsIssue[] = [];
  const payAtPropertyEnabled = candidate.payAtPropertyEnabled;
  if (typeof payAtPropertyEnabled !== "boolean")
    issues.push({
      field: "payAtPropertyEnabled",
      message: "Indique si pagar al llegar está habilitado.",
    });
  const payOnlineEnabled = candidate.payOnlineEnabled;
  if (typeof payOnlineEnabled !== "boolean")
    issues.push({
      field: "payOnlineEnabled",
      message: "Indique si pagar online está habilitado.",
    });
  if (issues.length)
    throw new PaymentMethodSettingsInputError(Object.freeze(issues));

  return Object.freeze({
    payAtPropertyEnabled: payAtPropertyEnabled as boolean,
    payOnlineEnabled: payOnlineEnabled as boolean,
  });
}

export type PaymentMethodSettingsRepository = Readonly<{
  get: () => Promise<PaymentMethodSettings>;
  update: (
    input: PaymentMethodSettingsInput
  ) => Promise<PaymentMethodSettings>;
}>;

const defaultPaymentMethodSettings: PaymentMethodSettings = Object.freeze({
  payAtPropertyEnabled: true,
  payOnlineEnabled: true,
});

export function createMockPaymentMethodSettingsRepository(
  initial: PaymentMethodSettings = defaultPaymentMethodSettings
): PaymentMethodSettingsRepository {
  let current = initial;
  return Object.freeze({
    get: async () => current,
    update: async (input) => {
      current = Object.freeze({ ...input });
      return current;
    },
  });
}

const mockPaymentMethodSettingsRepository =
  createMockPaymentMethodSettingsRepository();

export function getPaymentMethodSettingsRepository(
  context: "mock" | "production"
): PaymentMethodSettingsRepository | null {
  return context === "mock" ? mockPaymentMethodSettingsRepository : null;
}
