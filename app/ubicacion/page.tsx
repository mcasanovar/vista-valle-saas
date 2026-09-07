import type { Metadata } from "next";
import { LocationTemplate } from "@/presentation/templates";

export const metadata: Metadata = {
  title: "Ubicación",
  description:
    "Ubica el hostal Vista Valle en Illapel con un mapa interactivo, su relación con la Plaza de Armas y cómo llegar.",
  alternates: {
    canonical: "/ubicacion",
  },
  openGraph: {
    title: "Ubicación | Vista Valle",
    description:
      "Ubica el hostal Vista Valle en Illapel con un mapa interactivo, su relación con la Plaza de Armas y cómo llegar.",
    url: "/ubicacion",
    type: "website",
  },
  twitter: {
    title: "Ubicación | Vista Valle",
    description:
      "Ubica el hostal Vista Valle en Illapel con un mapa interactivo, su relación con la Plaza de Armas y cómo llegar.",
  },
};

export default function LocationPage() {
  return <LocationTemplate />;
}
