import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorizeAdministrator: vi.fn(),
  createServerSupabaseAdapter: vi.fn(),
  redirect: vi.fn((location: string) => {
    throw new Error(`redirect:${location}`);
  }),
}));

vi.mock("next/font/google", () => ({
  Manrope: () => ({ variable: "" }),
  Source_Sans_3: () => ({ variable: "" }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/config/server", () => ({
  getServerEnvironment: () => ({ ADMIN_ALLOWED_EMAILS: [] }),
}));
vi.mock("@/infrastructure/auth/authorization", () => ({
  authorizeAdministrator: mocks.authorizeAdministrator,
}));
vi.mock("@/infrastructure/supabase/server", () => ({
  createServerSupabaseAdapter: mocks.createServerSupabaseAdapter,
}));
vi.mock("@/features/admin/admin-shell", () => ({
  AdminShell: () => null,
}));

import ProtectedAdminLayout from "../app/(admin-protected)/admin/layout";

describe("protected admin layout", () => {
  it("redirects to login when server-side adapter verification fails", async () => {
    mocks.createServerSupabaseAdapter.mockRejectedValueOnce(
      new Error("Unable to verify the Supabase server session")
    );

    await expect(
      ProtectedAdminLayout({ children: <p>Privado</p> })
    ).rejects.toThrow("redirect:/admin/login");
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/login");
    expect(mocks.authorizeAdministrator).not.toHaveBeenCalled();
  });
});
