"use client";

import { MotionConfig } from "framer-motion";
import { Icon, type IconName } from "@/presentation/atoms";
import Image from "next/image";
import {
  CompanyCta,
  Hero,
  LocationSection,
  PublicFooter,
  PublicHeader,
  Reveal,
  RoomCard,
  RoomPhotoGalleryProvider,
} from "@/presentation/organisms";
import { publicSiteContent } from "@/config/public-site-content";

type CompanyEnquiryPresentation =
  | Readonly<{ kind: "demo" }>
  | Readonly<{
      kind: "contact";
      contact: Readonly<{
        href: `mailto:${string}` | `tel:${string}` | `https://${string}`;
        label: string;
      }>;
    }>
  | Readonly<{ kind: "pending" }>;

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

export function PublicHomeTemplate({
  companyEnquiry,
  bookingSearch = null,
  rooms,
}: Readonly<{
  bookingSearch?: React.ReactNode;
  companyEnquiry: CompanyEnquiryPresentation;
  rooms: readonly RoomPresentationModel[];
}>) {
  const content = publicSiteContent;

  return (
    <MotionConfig reducedMotion="user">
      <PublicHeader
        brandLabel={content.brandLabel}
        homeHref="#inicio"
        items={content.navigation}
        bookingHref="#consulta-disponibilidad"
        bookingLabel="Reservar"
      />
      <main id="main-content" className="bg-background">
        <Reveal>
          <div id="inicio">
            <Hero {...content.hero} />
          </div>
        </Reveal>
        <Reveal delay={0.04}>
          <section
            id="consulta-disponibilidad"
            aria-label={content.booking.formLabel}
            className="relative z-10 mx-auto -mt-12 max-w-content px-4 pb-10 phone:px-6 tablet:-mt-14 tablet:px-8 tablet:pb-14"
          >
            {bookingSearch}
          </section>
        </Reveal>
        <Reveal delay={0.06}>
          <section
            id="habitaciones"
            className="mx-auto max-w-content space-y-7 px-4 py-10 phone:px-6 tablet:px-8 tablet:py-14"
          >
            <div className="mx-auto max-w-prose text-center">
              <p className="text-label font-semibold uppercase tracking-[0.18em] text-accent">
                Catálogo
              </p>
              <h2 className="mt-2 font-heading text-title font-normal text-foreground">
                {content.rooms.title}
              </h2>
              <span
                aria-hidden="true"
                className="mx-auto mt-3 block h-px w-8 bg-accent"
              />
            </div>
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
                  />
                ))}
              </div>
            </RoomPhotoGalleryProvider>
          </section>
        </Reveal>
        <Reveal delay={0.08}>
          <section
            id="nosotros"
            className="mx-auto max-w-content px-4 py-10 phone:px-6 tablet:px-8 tablet:py-14"
          >
            <div className="mx-auto max-w-prose text-center pb-6">
              <h2 className="font-heading text-title font-semibold text-foreground">
                {content.reasons.title}
              </h2>
            </div>
            <ul className="mt-8 grid gap-8 tablet:grid-cols-2 laptop:grid-cols-4">
              {content.reasons.items.map((item, index) => (
                <li
                  key={item.id}
                  className="border-t border-border pt-6 text-left first:border-t-0 first:pt-0 tablet:border-t-0 tablet:border-l tablet:px-6 tablet:pt-0 tablet:first:border-l-0 tablet:first:px-0"
                >
                  <div className="flex items-baseline gap-3">
                    <span
                      aria-hidden="true"
                      className="font-heading text-4xl leading-none text-accent/70"
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Icon
                      decorative
                      name={item.icon as IconName}
                      className="text-accent"
                    />
                  </div>
                  <p className="mt-4 font-heading text-xl text-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>
        <Reveal delay={0.14}>
          <CompanyCta
            id="empresas"
            {...content.company}
            image={rooms[0] ? { src: rooms[0].images[0].src } : undefined}
            href={
              companyEnquiry.kind === "contact"
                ? companyEnquiry.contact.href
                : undefined
            }
            label={
              companyEnquiry.kind === "contact"
                ? companyEnquiry.contact.label
                : undefined
            }
            ctaHref={
              companyEnquiry.kind === "demo" ? "/cotizacion-empresa" : undefined
            }
            ctaLabel={
              companyEnquiry.kind === "demo"
                ? "Solicitar cotización"
                : undefined
            }
          />
        </Reveal>
        <Reveal delay={0.12}>
          <section className="relative aspect-[60/13]">
            <Image
              src="/brand/panoramic-bg.png"
              alt="Vista Valle Lodging House"
              fill
              sizes="100vw"
              className="object-cover"
            />
          </section>
        </Reveal>
        <Reveal delay={0.16}>
          <LocationSection id="ubicacion" title={content.location.title} />
        </Reveal>
      </main>
      <PublicFooter
        brandDescription={content.footer.brandDescription}
        socials={content.footer.socials}
        navigation={content.footer.navigation}
        contacts={content.footer.contacts}
        whatsapp={content.footer.whatsapp}
        copyright={content.footer.copyright}
      />
    </MotionConfig>
  );
}
