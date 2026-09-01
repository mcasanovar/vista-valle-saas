import { Feedback, Heading, Text } from "@/presentation/atoms";
import { Suspense } from "react";
import { publicSiteContent } from "@/config/public-site-content";
import {
  PublicFooter,
  PublicHeader,
  RoomCard,
  RoomPhotoGalleryProvider,
} from "@/presentation/organisms";

const navigation = [
  { href: "/", label: "Inicio" },
  { href: "/habitaciones", label: "Habitaciones" },
  { href: "/#servicios", label: "Servicios" },
  { href: "/#nosotros", label: "Nosotros" },
  { href: "/#empresas", label: "Empresas" },
  { href: "/#ubicacion", label: "Ubicación" },
  { href: "/#contacto", label: "Contacto" },
] as const;

type RoomPresentationModel = Readonly<{
  amenities: readonly string[];
  bathroom: string;
  bedConfiguration: string;
  capacity: number;
  id: string;
  images: readonly Readonly<{ alt: string; src: string }>[];
  isDemonstration: boolean;
  name: string;
  nightlyPriceClp: number;
  slug: string;
}>;

export function RoomCatalogueTemplate({
  rooms,
}: Readonly<{ rooms: readonly RoomPresentationModel[] }>) {
  const showsDemonstrationContent = rooms.some((room) => room.isDemonstration);

  return (
    <>
      <PublicHeader
        brandLabel="Vista Valle"
        homeHref="/"
        items={navigation}
        bookingHref="/#consulta-disponibilidad"
        bookingLabel="Reservar"
      />
      <main id="main-content" className="bg-warm">
        <section className="mx-auto max-w-content space-y-7 px-4 py-10 phone:px-6 tablet:px-8 tablet:py-14">
          <div className="max-w-prose space-y-3">
            <Heading level={1}>Habitaciones</Heading>
            <Text className="text-muted-foreground">
              Conoce las alternativas disponibles y consulta su disponibilidad.
            </Text>
          </div>
          {showsDemonstrationContent ? (
            <Feedback variant="info" title="Contenido de demostración">
              Estas habitaciones, sus características y precios son datos
              ficticios para validar la interfaz. No corresponden a una oferta
              comercial.
            </Feedback>
          ) : null}
          {rooms.length ? (
            <Suspense fallback={<div aria-live="polite" className="grid min-h-64 gap-5 tablet:grid-cols-2 laptop:grid-cols-3" />}>
              <RoomPhotoGalleryProvider>
                <div className="grid gap-5 tablet:grid-cols-2 laptop:grid-cols-3">
                {rooms.map((room, index) => (
                  <RoomCard
                    key={room.id}
                    numberLabel={`Habitación N.° ${String(index + 1).padStart(2, "0")}`}
                    image={{ src: room.images[0].src, alt: room.images[0].alt }}
                    images={room.images}
                    roomSlug={room.slug}
                    name={room.name}
                    capacity={`${room.capacity} huéspedes`}
                    beds={room.bedConfiguration}
                    bathroom={room.bathroom}
                    amenities={room.amenities}
                    price={room.nightlyPriceClp}
                    priceSuffix="CLP / noche"
                    detailHref={`/habitaciones/${room.slug}`}
                    detailLabel="Ver habitación"
                    headingLevel={2}
                  />
                ))}
                </div>
              </RoomPhotoGalleryProvider>
            </Suspense>
          ) : (
            <Text className="text-muted-foreground">
              Las habitaciones se publicarán cuando cuenten con información
              aprobada.
            </Text>
          )}
        </section>
      </main>
      <PublicFooter {...publicSiteContent.footer} />
    </>
  );
}
