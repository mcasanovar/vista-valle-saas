export type StructuredRoom = Readonly<{
  amenities: readonly string[];
  capacity: number;
  description: string;
  isDemonstration: boolean;
  name: string;
  slug: string;
}>;

const demonstrationProperty = {
  "@type": "PropertyValue",
  name: "contentStatus",
  value: "Contenido de demostración; no es una oferta comercial.",
};

function roomEntity(room: StructuredRoom) {
  return {
    "@type": "HotelRoom",
    "@id": `#room-${room.slug}`,
    name: room.name,
    description: room.description,
    occupancy: {
      "@type": "QuantitativeValue",
      maxValue: room.capacity,
    },
    amenityFeature: room.amenities.map((name) => ({
      "@type": "LocationFeatureSpecification",
      name,
      value: true,
    })),
  };
}

export function createLodgingStructuredData(
  siteUrl: string,
  rooms: readonly StructuredRoom[]
) {
  const normalizedSiteUrl = siteUrl.replace(/\/$/, "");
  const publishedRooms = rooms.filter((room) => !room.isDemonstration);
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    "@id": `${normalizedSiteUrl}/#lodging-business`,
    name: "Vista Valle",
    description:
      "Alojamiento y habitaciones de Vista Valle en Illapel. Información pública en preparación.",
    url: normalizedSiteUrl,
  };

  if (publishedRooms.length) {
    data.containsPlace = publishedRooms.map(roomEntity);
  }

  if (rooms.some((room) => room.isDemonstration)) {
    data.additionalProperty = [demonstrationProperty];
  }

  return data;
}

export function createRoomStructuredData(
  siteUrl: string,
  room: StructuredRoom
) {
  const lodging = createLodgingStructuredData(siteUrl, [room]);

  if (room.isDemonstration) {
    return lodging;
  }

  return {
    ...lodging,
    mainEntity: roomEntity(room),
  };
}
