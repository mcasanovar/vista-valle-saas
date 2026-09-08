import "server-only";

import { z } from "zod";

import { formatEnvironmentError, getPublicEnvironment } from "@/config/public";

const positiveInteger = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(1));

const nonNegativeInteger = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(0));

const allowedAdministratorEmails = z
  .string()
  .trim()
  .min(1)
  .transform((value, context) => {
    const emails = [
      ...new Set(
        value
          .split(",")
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean)
      ),
    ];

    if (emails.length === 0) {
      context.addIssue({
        code: "custom",
        message: "must contain at least one email",
      });
      return z.NEVER;
    }

    for (const email of emails) {
      if (!z.email().safeParse(email).success) {
        context.addIssue({
          code: "custom",
          message: "must contain only valid emails",
        });
        return z.NEVER;
      }
    }

    return Object.freeze(emails);
  });

const serverEnvironmentSchema = z.object({
  ADMIN_ALLOWED_EMAILS: allowedAdministratorEmails,
  AI_API_KEY: z.string().trim().min(1),
  AI_MODEL: z.string().trim().min(1),
  AI_PROVIDER: z.string().trim().min(1),
  ADMIN_NOTIFICATION_EMAIL: z.email(),
  ASSISTANT_PROPOSAL_TTL_MINUTES: positiveInteger,
  /** Operational kill switch for new reservations; defaults to enabled so an unset value never silently blocks bookings. */
  BOOKING_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  BOOKING_HOLD_DURATION_MINUTES: positiveInteger,
  /** Bearer secret for the internal channel-sync polling endpoint. */
  CHANNEL_SYNC_PROCESSOR_SECRET: z.string().trim().min(32).optional(),
  CLOUDINARY_API_KEY: z.string().trim().min(1),
  CLOUDINARY_API_SECRET: z.string().trim().min(1),
  CLOUDINARY_CLOUD_NAME: z.string().trim().min(1),
  DATABASE_URL: z
    .url()
    .refine(
      (value) =>
        value.startsWith("postgres://") || value.startsWith("postgresql://"),
      "must be a PostgreSQL connection URL"
    ),
  FINTOC_API_KEY: z.string().trim().min(1),
  FINTOC_WEBHOOK_SECRET: z.string().trim().min(1),
  MERCADO_PAGO_ACCESS_TOKEN: z.string().trim().min(1),
  MERCADO_PAGO_WEBHOOK_SECRET: z.string().trim().min(1),
  NOTIFICATION_MAX_RETRIES: nonNegativeInteger,
  OUTBOX_PROCESSOR_SECRET: z.string().trim().min(32).optional(),
  RESEND_API_KEY: z.string().trim().min(1),
  RESEND_DELIVERY_MODE: z.enum(["mock", "real"]).default("mock"),
  RESEND_FROM_EMAIL: z.email(),
  /** Display name shown alongside RESEND_FROM_EMAIL in the sender identity, e.g. "Name <email>". Configurable so a testing domain can use its own name instead of the production brand. */
  RESEND_FROM_NAME: z.string().trim().min(1).default("Vista Valle SpA"),
  SITE_URL: z
    .url()
    .refine(
      (value) => value.startsWith("http://") || value.startsWith("https://"),
      "must be an HTTP(S) URL"
    ),
  SUPABASE_SERVICE_ROLE_KEY: z.string().trim().min(1),
  TIMEZONE: z.literal("America/Santiago"),
  VISTA_VALLE_CONFIG_CONTEXT: z
    .enum(["mock", "production"])
    .default("production"),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

const configurationValuesThatMayBeMocked = [
  "ADMIN_ALLOWED_EMAILS",
  "ADMIN_NOTIFICATION_EMAIL",
  "AI_API_KEY",
  "AI_MODEL",
  "AI_PROVIDER",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CHANNEL_SYNC_PROCESSOR_SECRET",
  "DATABASE_URL",
  "FINTOC_API_KEY",
  "FINTOC_WEBHOOK_SECRET",
  "MERCADO_PAGO_ACCESS_TOKEN",
  "MERCADO_PAGO_WEBHOOK_SECRET",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "SITE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OUTBOX_PROCESSOR_SECRET",
] as const;

function isMockValue(value: string | undefined) {
  return /mock|REPLACE_WITH|YOUR_|\.test(?:\/|$)/i.test(value ?? "");
}

function assertMockValuesAreExplicitlyAllowed(
  environment: Record<string, string | undefined>,
  context: ServerEnvironment["VISTA_VALLE_CONFIG_CONTEXT"]
) {
  if (context === "mock") {
    return;
  }

  const mockedKeys = configurationValuesThatMayBeMocked.filter((key) =>
    isMockValue(environment[key])
  );

  if (mockedKeys.length > 0) {
    throw new Error(
      `Invalid server environment configuration: ${mockedKeys.join(", ")} must not use mock or placeholder values in production`
    );
  }
}

function assertProductionNotificationConfiguration(
  environment: Record<string, string | undefined>,
  configuration: ServerEnvironment
) {
  if (configuration.VISTA_VALLE_CONFIG_CONTEXT !== "production") return;

  if (configuration.RESEND_DELIVERY_MODE !== "real") {
    throw new Error(
      "Invalid server environment configuration: RESEND_DELIVERY_MODE must be real in production"
    );
  }
  if (!environment.OUTBOX_PROCESSOR_SECRET?.trim()) {
    throw new Error(
      "Invalid server environment configuration: OUTBOX_PROCESSOR_SECRET is required in production"
    );
  }
  if (!environment.CHANNEL_SYNC_PROCESSOR_SECRET?.trim()) {
    throw new Error(
      "Invalid server environment configuration: CHANNEL_SYNC_PROCESSOR_SECRET is required in production"
    );
  }
}

export function getServerEnvironment(
  environment: Record<string, string | undefined> = process.env
): ServerEnvironment {
  const parsed = serverEnvironmentSchema.safeParse({
    ADMIN_ALLOWED_EMAILS: environment.ADMIN_ALLOWED_EMAILS,
    AI_API_KEY: environment.AI_API_KEY,
    AI_MODEL: environment.AI_MODEL,
    AI_PROVIDER: environment.AI_PROVIDER,
    ADMIN_NOTIFICATION_EMAIL: environment.ADMIN_NOTIFICATION_EMAIL,
    ASSISTANT_PROPOSAL_TTL_MINUTES: environment.ASSISTANT_PROPOSAL_TTL_MINUTES,
    BOOKING_ENABLED: environment.BOOKING_ENABLED,
    BOOKING_HOLD_DURATION_MINUTES: environment.BOOKING_HOLD_DURATION_MINUTES,
    CHANNEL_SYNC_PROCESSOR_SECRET: environment.CHANNEL_SYNC_PROCESSOR_SECRET,
    CLOUDINARY_API_KEY: environment.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: environment.CLOUDINARY_API_SECRET,
    CLOUDINARY_CLOUD_NAME: environment.CLOUDINARY_CLOUD_NAME,
    DATABASE_URL: environment.DATABASE_URL,
    FINTOC_API_KEY: environment.FINTOC_API_KEY,
    FINTOC_WEBHOOK_SECRET: environment.FINTOC_WEBHOOK_SECRET,
    MERCADO_PAGO_ACCESS_TOKEN: environment.MERCADO_PAGO_ACCESS_TOKEN,
    MERCADO_PAGO_WEBHOOK_SECRET: environment.MERCADO_PAGO_WEBHOOK_SECRET,
    NOTIFICATION_MAX_RETRIES: environment.NOTIFICATION_MAX_RETRIES,
    OUTBOX_PROCESSOR_SECRET: environment.OUTBOX_PROCESSOR_SECRET,
    RESEND_API_KEY: environment.RESEND_API_KEY,
    RESEND_DELIVERY_MODE: environment.RESEND_DELIVERY_MODE,
    RESEND_FROM_EMAIL: environment.RESEND_FROM_EMAIL,
    RESEND_FROM_NAME: environment.RESEND_FROM_NAME,
    SITE_URL: environment.SITE_URL,
    SUPABASE_SERVICE_ROLE_KEY: environment.SUPABASE_SERVICE_ROLE_KEY,
    TIMEZONE: environment.TIMEZONE,
    VISTA_VALLE_CONFIG_CONTEXT: environment.VISTA_VALLE_CONFIG_CONTEXT,
  });

  if (!parsed.success) {
    throw formatEnvironmentError("server", parsed.error);
  }

  assertMockValuesAreExplicitlyAllowed(
    environment,
    parsed.data.VISTA_VALLE_CONFIG_CONTEXT
  );
  assertProductionNotificationConfiguration(environment, parsed.data);

  return parsed.data;
}

export function validateRuntimeEnvironment() {
  const publicEnvironment = getPublicEnvironment();
  const serverEnvironment = getServerEnvironment();

  if (
    publicEnvironment.NEXT_PUBLIC_VISTA_VALLE_CONFIG_CONTEXT !==
    serverEnvironment.VISTA_VALLE_CONFIG_CONTEXT
  ) {
    throw new Error(
      "Invalid environment configuration: public and server configuration contexts must match"
    );
  }
}
