import { BreakfastCatalogSettings } from "@/features/admin/breakfast-catalog-settings";
import { PaymentMethodsSettings } from "@/features/admin/payment-methods-settings";

export default function AdminConfigurationPage() {
  return (
    <div className="space-y-6">
      <PaymentMethodsSettings />
      <BreakfastCatalogSettings />
    </div>
  );
}
