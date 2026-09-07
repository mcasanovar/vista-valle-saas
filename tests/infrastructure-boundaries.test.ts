import { describe, expect, it, vi } from "vitest";

import { createBrowserSupabaseAdapter } from "@/infrastructure/supabase/browser";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { createServerSupabaseAdapter } from "@/infrastructure/supabase/server";
import { getServerEnvironment } from "@/config/server";
import { mockAdministrativeSession } from "@/infrastructure/supabase/mock";

describe("mock infrastructure boundaries", () => {
  it("selects deterministic adapters without network activity or server secrets in browser code", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const browserAdapter = createBrowserSupabaseAdapter();
    const serverAdapter = await createServerSupabaseAdapter();
    const databaseBoundary = createDatabaseBoundary();

    expect(browserAdapter.context).toBe("mock");
    expect(serverAdapter.context).toBe("mock");
    expect(databaseBoundary).toEqual({ context: "mock" });
    expect(await serverAdapter.session.getSession()).toEqual(
      mockAdministrativeSession
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects mock credentials when production is selected", () => {
    expect(() =>
      getServerEnvironment({
        ADMIN_NOTIFICATION_EMAIL: "admin@example.test",
        ADMIN_ALLOWED_EMAILS: "mock-admin@example.test",
        AI_API_KEY: "mock-ai-api-key",
        AI_MODEL: "mock-ai-model",
        AI_PROVIDER: "mock-ai-provider",
        ASSISTANT_PROPOSAL_TTL_MINUTES: "10",
        BOOKING_ENABLED: "false",
        BOOKING_HOLD_DURATION_MINUTES: "15",
        CLOUDINARY_API_KEY: "mock-cloudinary-api-key",
        CLOUDINARY_API_SECRET: "mock-cloudinary-api-secret",
        CLOUDINARY_CLOUD_NAME: "mock-cloudinary-cloud-name",
        DATABASE_URL:
          "postgresql://mock_user:mock_password@localhost:5432/mock_vista_valle",
        FINTOC_API_KEY: "mock-fintoc-api-key",
        FINTOC_WEBHOOK_SECRET: "mock-fintoc-webhook-secret",
        MERCADO_PAGO_ACCESS_TOKEN: "mock-mercado-pago-access-token",
        MERCADO_PAGO_WEBHOOK_SECRET: "mock-mercado-pago-webhook-secret",
        NOTIFICATION_MAX_RETRIES: "3",
        OUTBOX_PROCESSOR_SECRET: "mock-outbox-processor-secret-000000",
        RESEND_API_KEY: "mock-resend-api-key",
        RESEND_DELIVERY_MODE: "real",
        RESEND_FROM_EMAIL: "reservas@vistavalle.cl",
        SITE_URL: "https://mock-vista-valle.example.test",
        SUPABASE_SERVICE_ROLE_KEY: "mock-supabase-service-role-key",
        TIMEZONE: "America/Santiago",
        VISTA_VALLE_CONFIG_CONTEXT: "production",
      })
    ).toThrow(/must not use mock or placeholder values/);
  });

  it("rejects a mock administrator allowlist in production", () => {
    expect(() =>
      getServerEnvironment({
        ADMIN_ALLOWED_EMAILS: "mock-admin@example.test",
        ADMIN_NOTIFICATION_EMAIL: "admin@company.cl",
        AI_API_KEY: "key",
        AI_MODEL: "model",
        AI_PROVIDER: "provider",
        ASSISTANT_PROPOSAL_TTL_MINUTES: "10",
        BOOKING_ENABLED: "false",
        BOOKING_HOLD_DURATION_MINUTES: "15",
        CLOUDINARY_API_KEY: "key",
        CLOUDINARY_API_SECRET: "secret",
        CLOUDINARY_CLOUD_NAME: "cloud-name",
        DATABASE_URL: "postgresql://user:password@host:5432/database",
        FINTOC_API_KEY: "key",
        FINTOC_WEBHOOK_SECRET: "secret",
        MERCADO_PAGO_ACCESS_TOKEN: "token",
        MERCADO_PAGO_WEBHOOK_SECRET: "secret",
        NOTIFICATION_MAX_RETRIES: "3",
        OUTBOX_PROCESSOR_SECRET: "production-outbox-processor-secret-000000",
        RESEND_API_KEY: "key",
        RESEND_DELIVERY_MODE: "real",
        RESEND_FROM_EMAIL: "reservas@vistavalle.cl",
        SITE_URL: "https://vista-valle.cl",
        SUPABASE_SERVICE_ROLE_KEY: "service-role",
        TIMEZONE: "America/Santiago",
        VISTA_VALLE_CONFIG_CONTEXT: "production",
      })
    ).toThrow(/ADMIN_ALLOWED_EMAILS/);
  });
});
