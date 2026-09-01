import { redirect } from "next/navigation";
import { Manrope, Source_Sans_3 } from "next/font/google";
import type { ReactNode } from "react";

import { authorizeAdministrator } from "@/infrastructure/auth/authorization";
import { getServerEnvironment } from "@/config/server";
import { createServerSupabaseAdapter } from "@/infrastructure/supabase/server";
import { AdminShell } from "@/features/admin/admin-shell";

export const dynamic = "force-dynamic";

const adminManrope = Manrope({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-admin-manrope",
});

const adminSourceSans = Source_Sans_3({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-admin-source-sans",
});

export default async function ProtectedAdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const authorization = await (async () =>
    authorizeAdministrator(
      await createServerSupabaseAdapter(),
      getServerEnvironment().ADMIN_ALLOWED_EMAILS
    ))().catch(() => null);

  // Session verification failures are indistinguishable from an absent session
  // at this UI boundary. Never render the protected surface with an unverified
  // identity; the API boundary continues to reject these failures explicitly.
  if (!authorization || !authorization.authorized) {
    redirect("/admin/login");
  }

  return (
    <div className={`${adminManrope.variable} ${adminSourceSans.variable}`}>
      <AdminShell email={authorization.session.user.email ?? undefined}>
        {children}
      </AdminShell>
    </div>
  );
}
