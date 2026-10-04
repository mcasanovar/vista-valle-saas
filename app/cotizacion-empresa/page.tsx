import type { Metadata } from "next";

import { getServerEnvironment } from "@/config/server";
import { StructuredData } from "@/presentation/organisms";
import { CompanyQuotationTemplate } from "@/presentation/templates";
import { createBreadcrumbStructuredData } from "@/seo/structured-data";

export const metadata: Metadata = {
  title: "Cotización para empresas",
  description:
    "Cotiza alojamiento para empresas en Vista Valle, Illapel, y calcula el valor total de la estadía de tu equipo.",
  alternates: { canonical: "/cotizacion-empresa" },
  robots: { follow: true, index: false },
};

export default function CompanyQuotationPage() {
  const siteUrl = getServerEnvironment().SITE_URL;
  const breadcrumb = createBreadcrumbStructuredData(siteUrl, [
    { name: "Cotización para empresas", url: "/cotizacion-empresa" },
  ]);

  return (
    <>
      <CompanyQuotationTemplate />
      <StructuredData data={breadcrumb} />
    </>
  );
}
