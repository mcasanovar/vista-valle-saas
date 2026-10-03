import { AdminLoginForm } from "@/features/admin/admin-login-form";
import { getServerEnvironment } from "@/config/server";

// The only prerenderable admin route: without this, it could be served from
// a shared cache while the proxy attaches freshly rotated session cookies to
// the same path (harden-admin-authentication, task 4.4).
export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <AdminLoginForm
      context={getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT}
    />
  );
}
