import { BreakfastCatalogSettings } from "@/features/admin/breakfast-catalog-settings";
import { PaymentMethodsSettings } from "@/features/admin/payment-methods-settings";
import { requireAdministrator } from "@/infrastructure/auth/authorization";

export const dynamic = "force-dynamic";

export default async function AdminConfigurationPage() {
  await requireAdministrator();
  return (
    <div className="space-y-6">
      <PaymentMethodsSettings />
      <BreakfastCatalogSettings />
    </div>
  );
}
