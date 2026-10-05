import type { Metadata } from "next";

const siteDescription =
  "Conoce Vista Valle, alojamiento y habitaciones en Illapel. Revisa la información pública y consulta tu estadía.";

export function createPublicMetadata(siteUrl: string): Metadata {
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: "Habitaciones Vista Valle | Alojamiento en Illapel",
      template: "%s | Habitaciones Vista Valle",
    },
    description: siteDescription,
    keywords: [
      "Habitaciones Vista Valle",
      "Vista Valle",
      "alojamiento en Illapel",
      "habitaciones en Illapel",
    ],
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      locale: "es_CL",
      url: siteUrl,
      siteName: "Habitaciones Vista Valle",
      title: "Habitaciones Vista Valle | Alojamiento en Illapel",
      description: siteDescription,
      images: [
        {
          url: "/brand/bg-hero.png",
          alt: "Fachada de Vista Valle con montañas nevadas al fondo",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Habitaciones Vista Valle | Alojamiento en Illapel",
      description: siteDescription,
      images: ["/brand/bg-hero.png"],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}
