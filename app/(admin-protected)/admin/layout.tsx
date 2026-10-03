import { redirect } from "next/navigation";
import { Manrope, Source_Sans_3 } from "next/font/google";
import type { ReactNode } from "react";

import { getCachedAdministrativeAuthorization } from "@/infrastructure/auth/authorization";
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
  const authorization = await getCachedAdministrativeAuthorization().catch(
    () => null
  );

  // Session verification failures are indistinguishable from an absent session
  // at this UI boundary. Never render the protected surface with an unverified
  // identity; the API boundary continues to reject these failures explicitly.
  //
  // This check is UX redirection, NOT the security boundary: Next.js skips
  // ancestor layouts for a server-component request whose client-supplied
  // router state tree already matches down to a deeper segment (see
  // `node_modules/next/dist/server/app-render/app-render.tsx`, the
  // `walkTreeWithFlightRouterState`/`matchSegment` handling that renders from
  // the matched segment without re-running parent layouts). Every page under
  // this group, and every admin data-access function it calls, calls
  // `requireAdministrator()` itself (harden-admin-authentication, tasks 1.1
  // and 1.2) — that is the actual barrier.
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
