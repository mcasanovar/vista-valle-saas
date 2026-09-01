import type { Metadata } from "next";

import { CompanyQuotationTemplate } from "@/presentation/templates";

export const metadata: Metadata = {
  title: "Cotización para empresas",
  description:
    "Calcula una cotización de alojamiento para tu empresa en Vista Valle.",
  alternates: { canonical: "/cotizacion-empresa" },
  robots: { follow: true, index: false },
};

export default function CompanyQuotationPage() {
  return <CompanyQuotationTemplate />;
}
