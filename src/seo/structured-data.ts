import { publicFaq, publicSiteContent } from "@/config/public-site-content";

export type StructuredRoom = Readonly<{
  amenities: readonly string[];
  capacity: number;
  description: string;
  images?: readonly Readonly<{ alt: string; src: string }>[];
  isDemonstration: boolean;
  name: string;
  nightlyPriceClp?: number;
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
    ...(room.nightlyPriceClp !== undefined
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "CLP",
            price: room.nightlyPriceClp,
          },
        }
      : {}),
  };
}

/** Site-wide amenities, confirmed by the owner (see `publicSiteContent.services`). */
function lodgingAmenityFeature() {
  return publicSiteContent.services.items.map((item) => ({
    "@type": "LocationFeatureSpecification",
    name: item.title,
    value: true,
  }));
}

/** Absolute, deduplicated photo URLs: the hero image plus each published room's cover photo. */
function lodgingImages(
  normalizedSiteUrl: string,
  publishedRooms: readonly StructuredRoom[]
) {
  const toAbsolute = (src: string) =>
    src.startsWith("http") ? src : `${normalizedSiteUrl}${src}`;
  const urls = [
    `${normalizedSiteUrl}/brand/bg-hero.png`,
    ...publishedRooms.flatMap((room) =>
      room.images?.length ? [toAbsolute(room.images[0].src)] : []
    ),
  ];
  return [...new Set(urls)];
}

function lodgingPriceRange(publishedRooms: readonly StructuredRoom[]) {
  const prices = publishedRooms
    .map((room) => room.nightlyPriceClp)
    .filter((price): price is number => price !== undefined);
  if (!prices.length) return undefined;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const format = (value: number) => `$${value.toLocaleString("es-CL")}`;
  return min === max
    ? `${format(min)} CLP`
    : `${format(min)} - ${format(max)} CLP`;
}

export function createLodgingStructuredData(
  siteUrl: string,
  rooms: readonly StructuredRoom[]
) {
  const normalizedSiteUrl = siteUrl.replace(/\/$/, "");
  const publishedRooms = rooms.filter((room) => !room.isDemonstration);
  const { stayPolicies, externalProfiles } = publicSiteContent;
  const emailContact = publicSiteContent.footer.contacts.find(
    (contact) => contact.id === "email"
  );
  const addressMapContact = publicSiteContent.footer.contacts.find(
    (contact) => contact.id === "address"
  );
  const sameAs = Object.values(externalProfiles).map((profile) => profile.href);

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    "@id": `${normalizedSiteUrl}/#lodging-business`,
    name: "Vista Valle",
    description:
      "Servicio de alojamiento para turistas y empresas en la ciudad de Illapel",
    url: normalizedSiteUrl,
    telephone: "+56945981722",
    image: lodgingImages(normalizedSiteUrl, publishedRooms),
    address: {
      "@type": "PostalAddress",
      streetAddress: "Flor de Mayo #55",
      addressLocality: "Illapel",
      addressRegion: "Coquimbo",
      addressCountry: "CL",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: publicSiteContent.location.hostal.position[0],
      longitude: publicSiteContent.location.hostal.position[1],
    },
    checkinTime: stayPolicies.checkInTime,
    checkoutTime: stayPolicies.checkOutTime,
    petsAllowed: stayPolicies.petsAllowed,
    amenityFeature: lodgingAmenityFeature(),
  };

  if (emailContact) data.email = emailContact.label;
  if (addressMapContact) data.hasMap = addressMapContact.href;
  if (sameAs.length) data.sameAs = sameAs;

  const priceRange = lodgingPriceRange(publishedRooms);
  if (priceRange) data.priceRange = priceRange;

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

/** Derived from the same `publicFaq` array the FAQ section renders — never a question absent from the visible page. */
export function createFaqStructuredData() {
  if (!publicFaq.length) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: publicFaq.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: entry.answer,
      },
    })),
  };
}

export type BreadcrumbPage = Readonly<{ name: string; url: string }>;

/** `pages` are the trail from (but excluding) the home page to the current page, in order. */
export function createBreadcrumbStructuredData(
  siteUrl: string,
  pages: readonly BreadcrumbPage[]
) {
  const normalizedSiteUrl = siteUrl.replace(/\/$/, "");
  const trail = [{ name: "Inicio", url: normalizedSiteUrl }, ...pages];

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((page, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: page.name,
      item: page.url.startsWith("http")
        ? page.url
        : `${normalizedSiteUrl}${page.url}`,
    })),
  };
}
