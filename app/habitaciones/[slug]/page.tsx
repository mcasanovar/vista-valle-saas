import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRoomReadSource } from "@/features/rooms";
import { getServerEnvironment } from "@/config/server";
import { StructuredData } from "@/presentation/organisms";
import { RoomDetailTemplate } from "@/presentation/templates";
import {
  serializeAvailabilityResultsQuery,
  validateAvailabilityResultsQuery,
} from "@/features/availability";
import { createRoomStructuredData } from "@/seo/structured-data";

type RoomRouteProps = Readonly<{
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}>;

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

export default async function RoomDetailPage({
  params,
  searchParams,
}: RoomRouteProps) {
  const { slug } = await params;
  const roomSource = await getRoomReadSource();
  const room = roomSource.getActiveBySlug(slug);

  if (!room) {
    notFound();
  }

  const siteUrl = getServerEnvironment().SITE_URL;
  const context = searchParams
    ? validateAvailabilityResultsQuery(await searchParams)
    : null;
  const availabilityHref = context?.ok
    ? serializeAvailabilityResultsQuery({ ...context.value, room: room.slug })
    : `/disponibilidad?room=${encodeURIComponent(room.slug)}`;

  return (
    <>
      <RoomDetailTemplate
        room={room}
        availabilityHref={availabilityHref}
        selectionRooms={roomSource.listActive()}
      />
      <StructuredData data={createRoomStructuredData(siteUrl, room)} />
    </>
  );
}
