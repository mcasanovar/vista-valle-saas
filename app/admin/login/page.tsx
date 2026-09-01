import { AdminLoginForm } from "@/features/admin/admin-login-form";
import { getServerEnvironment } from "@/config/server";

export default function AdminLoginPage() {
  return (
    <AdminLoginForm
      context={getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT}
    />
  );
}
