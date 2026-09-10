/* eslint-disable architecture/feature-public-api, architecture/presentation-boundaries */
import { ActionLink, Feedback, Heading, Text } from "@/presentation/atoms";
import {
  RoomCard,
  RoomPhotoGalleryProvider,
  PublicHeader,
  PublicFooter,
} from "@/presentation/organisms";
import {
  publicNavigationForRoute,
  publicSiteContent,
} from "@/config/public-site-content";
import type { ReactNode } from "react";
import { RoomSelectionSummary } from "@/features/reservations/room-selection-summary";
import { GuestAllocationBanner } from "@/features/reservations/guest-allocation-banner";

const navigation = publicNavigationForRoute(false);

type Room = Readonly<{
  id: string;
  name: string;
  slug: string;
  capacity: number;
  bedConfiguration: string;
  bathroom: string;
  amenities: readonly string[];
  images: readonly Readonly<{ src: string; alt: string }>[];
  nightlyPriceClp: number;
  occupancyPrices: readonly Readonly<{ occupancy: number; priceClp: number }>[];
  isDemonstration: boolean;
}>;

export function AvailabilityResultsTemplate({
  checkIn,
  checkOut,
  guests,
  room,
  errors,
  rooms = [],
  state,
  bookingSearch,
  results,
}: Readonly<{
  checkIn?: string;
  checkOut?: string;
  guests?: number;
  room?: string;
  errors?: Readonly<Record<string, string>>;
  rooms?: readonly Room[];
  state?: "invalid" | "unavailable" | "error" | "empty";
  bookingSearch?: ReactNode;
  results?: ReactNode;
}>) {
  const valid = Boolean(checkIn && checkOut && guests);
  const query = valid
    ? `checkIn=${encodeURIComponent(checkIn!)}&checkOut=${encodeURIComponent(checkOut!)}&guests=${guests}`
    : "";
  const selectedQuery = room
    ? `${query}&room=${encodeURIComponent(room)}`
    : query;
  return (
    <>
      <PublicHeader
        brandLabel="Vista Valle"
        homeHref="/"
        items={navigation}
        bookingHref="#busqueda-disponibilidad"
        bookingLabel="Reservar"
      />
      <main id="main-content" className="vv-availability-page bg-background">
        <RoomPhotoGalleryProvider>
          <section className="mx-auto max-w-content space-y-8 px-4 py-10 pb-32 phone:px-6 tablet:px-8 tablet:py-14 tablet:pb-32">
            <header className="max-w-prose space-y-3">
              <Heading level={1}>Disponibilidad</Heading>
              <Text className="text-muted-foreground">
                Consulta habitaciones disponibles para tu estadía en Vista
                Valle.
              </Text>
              {valid ? (
                <Text className="text-sm text-muted-foreground">
                  {checkIn} al {checkOut} · {guests}{" "}
                  {guests === 1 ? "huésped" : "huéspedes"}
                </Text>
              ) : null}
            </header>
            <section id="busqueda-disponibilidad" aria-label="Editar consulta">
              {bookingSearch}
            </section>
            {state === "invalid" ? (
              <Feedback variant="error" title="Revisa tu consulta">
                <ul className="list-disc space-y-1 pl-5">
                  {Object.values(errors ?? {}).map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </Feedback>
            ) : null}
            {state === "unavailable" ? (
              <Feedback variant="warning" title="Habitación no disponible">
                La habitación seleccionada ya no está disponible para estos
                criterios. Ajusta la consulta o retira la preselección.
                <div className="mt-3">
                  <ActionLink
                    href={`/disponibilidad?${query}`}
                    variant="action"
                  >
                    Quitar preselección
                  </ActionLink>
                </div>
              </Feedback>
            ) : null}
            {state === "error" ? (
              <Feedback
                variant="error"
                title="No pudimos consultar disponibilidad"
              >
                Intenta nuevamente con los mismos criterios.
                <div className="mt-3">
                  <ActionLink
                    href={`/disponibilidad?${selectedQuery}`}
                    variant="action"
                  >
                    Reintentar
                  </ActionLink>
                </div>
              </Feedback>
            ) : null}
            {results}
            {!state && results === undefined ? (
              <section
                aria-live="polite"
                aria-label="Resultados de disponibilidad"
              >
                <p className="mb-4 font-semibold text-foreground">
                  {rooms.length}{" "}
                  {rooms.length === 1
                    ? "habitación disponible"
                    : "habitaciones disponibles"}
                </p>
                <GuestAllocationBanner />
                <RoomSelectionSummary rooms={rooms} />
                {rooms.length ? (
                  <div className="grid gap-5 tablet:grid-cols-2 laptop:grid-cols-3">
                    {rooms.map((availableRoom, index) => (
                      <RoomCard
                        key={availableRoom.id}
                        numberLabel={`Habitación N.° ${String(index + 1).padStart(2, "0")}`}
                        image={availableRoom.images[0]}
                        images={availableRoom.images}
                        roomSlug={availableRoom.slug}
                        name={availableRoom.name}
                        capacity={`${availableRoom.capacity} huéspedes`}
                        capacityCount={availableRoom.capacity}
                        occupancyPrices={availableRoom.occupancyPrices}
                        beds={availableRoom.bedConfiguration}
                        bathroom={availableRoom.bathroom}
                        amenities={availableRoom.amenities}
                        price={availableRoom.nightlyPriceClp}
                        priceSuffix="CLP / noche"
                        detailHref={`/habitaciones/${availableRoom.slug}?${selectedQuery}${selectedQuery ? "&" : ""}room=${encodeURIComponent(availableRoom.slug)}`}
                        detailLabel="Ver habitación"
                        headingLevel={2}
                        selectable
                      />
                    ))}
                  </div>
                ) : (
                  <Feedback variant="info" title="Sin disponibilidad">
                    No hay habitaciones disponibles para estos criterios. Ajusta
                    fechas o huéspedes desde el buscador.
                  </Feedback>
                )}
                {rooms.some(
                  (availableRoom) => availableRoom.isDemonstration
                ) ? (
                  <p className="mt-6 text-sm text-muted-foreground">
                    Datos de demostración: habitaciones y precios ficticios para
                    validar la interfaz; no corresponden a una oferta comercial.
                  </p>
                ) : null}
              </section>
            ) : null}
          </section>
        </RoomPhotoGalleryProvider>
      </main>
      <PublicFooter {...publicSiteContent.footer} />
    </>
  );
}

export function AvailabilityResultsRegion({
  query,
  rooms,
  state,
}: Readonly<{
  query: Readonly<{
    checkIn: string;
    checkOut: string;
    guests: number;
    room?: string;
  }>;
  rooms?: readonly Room[];
  state?: "unavailable" | "error";
}>) {
  const baseQuery = `checkIn=${encodeURIComponent(query.checkIn)}&checkOut=${encodeURIComponent(query.checkOut)}&guests=${query.guests}`;
  const selectedQuery = query.room
    ? `${baseQuery}&room=${encodeURIComponent(query.room)}`
    : baseQuery;
  if (state === "unavailable") {
    return (
      <Feedback variant="warning" title="Habitación no disponible">
        La habitación seleccionada ya no está disponible para estos criterios.
        Ajusta la consulta o retira la preselección.
        <div className="mt-3">
          <ActionLink href={`/disponibilidad?${baseQuery}`} variant="action">
            Quitar preselección
          </ActionLink>
        </div>
      </Feedback>
    );
  }
  if (state === "error") {
    return (
      <Feedback variant="error" title="No pudimos consultar disponibilidad">
        Intenta nuevamente con los mismos criterios.
        <div className="mt-3">
          <ActionLink
            href={`/disponibilidad?${selectedQuery}`}
            variant="action"
          >
            Reintentar
          </ActionLink>
        </div>
      </Feedback>
    );
  }
  return (
    <section aria-live="polite" aria-label="Resultados de disponibilidad">
      <p className="mb-4 font-semibold text-foreground">
        {rooms?.length ?? 0}{" "}
        {(rooms?.length ?? 0) === 1
          ? "habitación disponible"
          : "habitaciones disponibles"}
      </p>
      <GuestAllocationBanner />
      {rooms ? <RoomSelectionSummary rooms={rooms} /> : null}
      {rooms?.length ? (
        <div className="grid gap-5 tablet:grid-cols-2 laptop:grid-cols-3">
          {rooms.map((availableRoom, index) => (
            <RoomCard
              key={availableRoom.id}
              numberLabel={`Habitación N.° ${String(index + 1).padStart(2, "0")}`}
              image={availableRoom.images[0]}
              images={availableRoom.images}
              roomSlug={availableRoom.slug}
              name={availableRoom.name}
              capacity={`${availableRoom.capacity} huéspedes`}
              capacityCount={availableRoom.capacity}
              occupancyPrices={availableRoom.occupancyPrices}
              beds={availableRoom.bedConfiguration}
              bathroom={availableRoom.bathroom}
              amenities={availableRoom.amenities}
              price={availableRoom.nightlyPriceClp}
              priceSuffix="CLP / noche"
              detailHref={`/habitaciones/${availableRoom.slug}?${selectedQuery}${selectedQuery ? "&" : ""}room=${encodeURIComponent(availableRoom.slug)}`}
              detailLabel="Ver habitación"
              headingLevel={2}
              selectable
            />
          ))}
        </div>
      ) : (
        <Feedback variant="info" title="Sin disponibilidad">
          No hay habitaciones disponibles para estos criterios. Ajusta fechas o
          huéspedes desde el buscador.
        </Feedback>
      )}
      {rooms?.some((availableRoom) => availableRoom.isDemonstration) ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Datos de demostración: habitaciones y precios ficticios para validar
          la interfaz; no corresponden a una oferta comercial.
        </p>
      ) : null}
    </section>
  );
}
