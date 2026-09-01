import type { Metadata } from "next";
import { getRoomReadSource } from "@/features/rooms";
import { getServerEnvironment } from "@/config/server";
import { StructuredData } from "@/presentation/organisms";
import { RoomCatalogueTemplate } from "@/presentation/templates";
import { createLodgingStructuredData } from "@/seo/structured-data";

export const metadata: Metadata = {
  title: "Habitaciones",
  description:
    "Explora las habitaciones de Vista Valle en Illapel y conoce sus características para planificar tu estadía.",
  alternates: {
    canonical: "/habitaciones",
  },
  openGraph: {
    title: "Habitaciones | Vista Valle",
    description:
      "Explora las habitaciones de Vista Valle en Illapel y conoce sus características para planificar tu estadía.",
    url: "/habitaciones",
    type: "website",
  },
  twitter: {
    title: "Habitaciones | Vista Valle",
    description:
      "Explora las habitaciones de Vista Valle en Illapel y conoce sus características para planificar tu estadía.",
  },
};

export default async function RoomCataloguePage() {
  const roomSource = await getRoomReadSource();
  const rooms = roomSource.listActive();
  const siteUrl = getServerEnvironment().SITE_URL;

  return (
    <>
      <RoomCatalogueTemplate rooms={rooms} />
      <StructuredData data={createLodgingStructuredData(siteUrl, rooms)} />
    </>
  );
}
