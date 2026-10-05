import type { Metadata } from "next";
import { getServerEnvironment } from "@/config/server";
import { StructuredData } from "@/presentation/organisms";
import { LocationTemplate } from "@/presentation/templates";
import { createBreadcrumbStructuredData } from "@/seo/structured-data";

export const metadata: Metadata = {
  title: "Ubicación",
  description:
    "Ubica el hostal Vista Valle en Illapel con un mapa interactivo, su relación con la Plaza de Armas y cómo llegar.",
  alternates: {
    canonical: "/ubicacion",
  },
  openGraph: {
    title: "Ubicación | Habitaciones Vista Valle",
    description:
      "Ubica el hostal Vista Valle en Illapel con un mapa interactivo, su relación con la Plaza de Armas y cómo llegar.",
    url: "/ubicacion",
    type: "website",
  },
  twitter: {
    title: "Ubicación | Habitaciones Vista Valle",
    description:
      "Ubica el hostal Vista Valle en Illapel con un mapa interactivo, su relación con la Plaza de Armas y cómo llegar.",
  },
};

export default function LocationPage() {
  const siteUrl = getServerEnvironment().SITE_URL;
  const breadcrumb = createBreadcrumbStructuredData(siteUrl, [
    { name: "Ubicación", url: "/ubicacion" },
  ]);

  return (
    <>
      <LocationTemplate />
      <StructuredData data={breadcrumb} />
    </>
  );
}
