import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRoomReadSource } from "@/features/rooms";
import { getServerEnvironment } from "@/config/server";
import { StructuredData } from "@/presentation/organisms";
import { RoomDetailTemplate } from "@/presentation/templates";
import {
  createBreadcrumbStructuredData,
  createRoomStructuredData,
} from "@/seo/structured-data";

type RoomRouteProps = Readonly<{
  params: Promise<{ slug: string }>;
}>;

export async function generateStaticParams() {
  const roomSource = await getRoomReadSource();
  return roomSource.listActive().map((room) => ({ slug: room.slug }));
}

export async function generateMetadata({
  params,
}: RoomRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const roomSource = await getRoomReadSource();
  const room = roomSource.getActiveBySlug(slug);

  if (!room) {
    notFound();
  }

  const description = room.isDemonstration
    ? `${room.description} Contenido de demostración; no es una oferta comercial.`
    : room.description;
  const canonical = `/habitaciones/${room.slug}`;

  return {
    title: room.name,
    description,
    alternates: {
      canonical,
    },
    openGraph: {
      type: "website",
      title: room.name,
      description,
      url: canonical,
      images: room.images.map((image) => ({
        url: image.src,
        alt: image.alt,
      })),
    },
    twitter: {
      card: "summary_large_image",
      title: room.name,
      description,
      images: room.images.map((image) => image.src),
    },
  };
}

export default async function RoomDetailPage({ params }: RoomRouteProps) {
  const { slug } = await params;
  const roomSource = await getRoomReadSource();
  const room = roomSource.getActiveBySlug(slug);

  if (!room) {
    notFound();
  }

  const siteUrl = getServerEnvironment().SITE_URL;
  const breadcrumb = createBreadcrumbStructuredData(siteUrl, [
    { name: "Habitaciones", url: "/habitaciones" },
    { name: room.name, url: `/habitaciones/${room.slug}` },
  ]);

  return (
    <>
      <RoomDetailTemplate room={room} selectionRooms={roomSource.listActive()} />
      <StructuredData data={createRoomStructuredData(siteUrl, room)} />
      <StructuredData data={breadcrumb} />
    </>
  );
}
