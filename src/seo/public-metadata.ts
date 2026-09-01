import type { Metadata } from "next";

const siteDescription =
  "Conoce Vista Valle, alojamiento y habitaciones en Illapel. Revisa la información pública y consulta tu estadía.";

export function createPublicMetadata(siteUrl: string): Metadata {
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: "Vista Valle | Alojamiento en Illapel",
      template: "%s | Vista Valle",
    },
    description: siteDescription,
    keywords: [
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
      siteName: "Vista Valle",
      title: "Vista Valle | Alojamiento en Illapel",
      description: siteDescription,
      images: [
        {
          url: "/brand/bg-hero.jpg",
          alt: "Fachada de Vista Valle con montañas nevadas al fondo",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Vista Valle | Alojamiento en Illapel",
      description: siteDescription,
      images: ["/brand/bg-hero.jpg"],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}
