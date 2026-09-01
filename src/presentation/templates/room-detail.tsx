/* eslint-disable architecture/feature-public-api, architecture/presentation-boundaries */
import {
  ActionLink,
  Feedback,
  Heading,
  Icon,
  Text,
  type IconName,
} from "@/presentation/atoms";
import { publicSiteContent } from "@/config/public-site-content";
import { Amenities, Price } from "@/presentation/molecules";
import {
  PublicFooter,
  PublicHeader,
  RoomGallery,
  RoomPhotoGalleryProvider,
} from "@/presentation/organisms";
import { RoomDetailSelectionButton } from "@/features/reservations/room-detail-selection-button";
import { RoomSelectionSummary } from "@/features/reservations/room-selection-summary";

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
  description: string;
  id: string;
  images: readonly Readonly<{ alt: string; id: string; src: string }>[];
  isDemonstration: boolean;
  name: string;
  nightlyPriceClp: number;
  slug: string;
}>;

export function RoomDetailTemplate({
  room,
  availabilityHref,
  selectionRooms = [room],
}: Readonly<{
  room: RoomPresentationModel;
  availabilityHref?: string;
  selectionRooms?: readonly Pick<
    RoomPresentationModel,
    "id" | "name" | "slug" | "nightlyPriceClp"
  >[];
}>) {
  return (
    <RoomPhotoGalleryProvider singleRoomSlug={room.slug}>
      <PublicHeader
        brandLabel="Vista Valle"
        homeHref="/"
        items={navigation}
        bookingHref={
          availabilityHref ??
          `/disponibilidad?room=${encodeURIComponent(room.slug)}`
        }
        bookingLabel="Reservar"
      />
      <main id="main-content" className="bg-warm">
        <article className="mx-auto max-w-content space-y-8 px-4 py-10 pb-32 phone:px-6 tablet:px-8 tablet:py-14 tablet:pb-32">
          {room.isDemonstration ? (
            <Feedback variant="info" title="Contenido de demostración">
              Esta habitación, sus características y precio son datos ficticios
              para validar la interfaz. No corresponde a una oferta comercial.
            </Feedback>
          ) : null}
          <header className="max-w-prose space-y-3">
            <Heading level={1}>{room.name}</Heading>
            <div
              className="h-[3px] w-[35px] bg-border rounded-md"
              style={{ backgroundColor: "#B6976D" }}
            />
            <Text className="text-muted-foreground">{room.description}</Text>
          </header>
          <RoomGallery
            label={`Galería de ${room.name}`}
            roomSlug={room.slug}
            images={room.images}
          />
          <div className="grid gap-8 laptop:grid-cols-[1fr_auto]">
            <section
              aria-labelledby="room-features-heading"
              className="space-y-5"
            >
              <h2
                id="room-features-heading"
                className="font-heading text-title font-normal text-foreground"
              >
                Características
              </h2>
              <div
                className="h-[1.5px] w-full bg-border rounded-md opacity-30"
                style={{ backgroundColor: "#B6976D" }}
              />
              <div className="grid gap-4 tablet:grid-cols-3">
                {(
                  [
                    {
                      icon: "Users",
                      label: "Capacidad",
                      value: `${room.capacity} huéspedes`,
                    },
                    {
                      icon: "Bed",
                      label: "Camas",
                      value: room.bedConfiguration,
                    },
                    { icon: "Bath", label: "Baño", value: room.bathroom },
                  ] satisfies readonly {
                    icon: IconName;
                    label: string;
                    value: string;
                  }[]
                ).map((feature) => (
                  <div key={feature.label} className="flex items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#B6976D]/15 text-foreground">
                      <Icon decorative name={feature.icon} />
                    </span>
                    <dl>
                      <div>
                        <dt className="text-sm text-muted-foreground">
                          {feature.label}
                        </dt>
                        <dd className="mt-1 font-semibold">{feature.value}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                <Heading level={2}>Servicios</Heading>
                <div
                  className="h-[1.5px] w-full bg-border rounded-md opacity-30"
                  style={{ backgroundColor: "#B6976D" }}
                />
                <Amenities
                  items={room.amenities.map((amenity) => ({
                    id: amenity,
                    label: amenity,
                  }))}
                />
              </div>
            </section>
            <div className="h-fit space-y-4 rounded-lg p-5 shadow-md bg-[#F7F2EC]/70">
              <Price
                amount={room.nightlyPriceClp}
                label=""
                suffix="CLP / noche"
              />
              <ActionLink
                href={
                  availabilityHref ??
                  `/disponibilidad?room=${encodeURIComponent(room.slug)}`
                }
                variant="action"
                className="w-full justify-center border-0"
              >
                Consultar disponibilidad
              </ActionLink>
              <RoomDetailSelectionButton slug={room.slug} />
              <ActionLink
                href="/habitaciones"
                className="inline-flex w-full items-center justify-center gap-2"
              >
                <Icon decorative name="ArrowLeft" className="size-4" />
                Volver a habitaciones
              </ActionLink>
            </div>
          </div>
        </article>
        <RoomSelectionSummary rooms={selectionRooms} />
      </main>
      <PublicFooter {...publicSiteContent.footer} />
    </RoomPhotoGalleryProvider>
  );
}
