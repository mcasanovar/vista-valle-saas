"use client";

import { MotionConfig } from "framer-motion";
import Image from "next/image";
import { ActionLink } from "@/presentation/atoms";
import {
  CompanyCta,
  Hero,
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
            className="relative z-10 mx-auto mt-0 max-w-content px-4 pb-10 phone:px-6 tablet:mt-0 tablet:px-8 tablet:pb-14"
          >
            {bookingSearch}
          </section>
        </Reveal>
        <Reveal delay={0.06}>
          <section
            id="habitaciones"
            className="vv-section mx-auto max-w-content space-y-7 px-4 phone:px-6 tablet:px-8"
          >
            <div className="vv-section-head vv-room-section-head">
              <h2 className="font-heading text-display font-normal text-foreground">
                {content.rooms.title}
              </h2>
              <p className="max-w-prose text-sm text-muted-foreground">
                {content.rooms.copy}
              </p>
            </div>
            <RoomPhotoGalleryProvider>
              <div className="vv-room-grid grid gap-5 tablet:grid-cols-2 laptop:grid-cols-3">
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
            className="vv-reasons"
          >
            <div className="vv-reasons-inner">
              <div className="vv-section-head vv-section-head-dark">
                <h2 className="font-heading text-display font-normal text-foreground">
                  {content.reasons.title}
                </h2>
                <p className="max-w-prose text-sm text-muted-foreground">
                  {content.reasons.copy}
                </p>
              </div>
              <ul className="vv-reason-grid grid gap-8 tablet:grid-cols-2 laptop:grid-cols-4">
                {content.reasons.items.map((item, index) => (
                  <li
                    key={item.id}
                    className="text-left"
                  >
                    <div className="flex items-baseline gap-3">
                      <span
                        aria-hidden="true"
                        className="font-heading text-2xl leading-none text-gold"
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <p className="mt-8 font-heading text-xl text-foreground">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </Reveal>
        <Reveal delay={0.14}>
          <CompanyCta
            id="empresas"
            {...content.company}
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
              content.company.quotation.enabled
                ? content.company.quotation.href
                : undefined
            }
            ctaLabel={
              content.company.quotation.enabled
                ? content.company.quotation.label
                : undefined
            }
          />
        </Reveal>
        <Reveal delay={0.12}>
          <section
            id="ubicacion"
            className="vv-panorama relative min-h-[22rem] overflow-hidden"
          >
            <Image
              src="/brand/panoramic-bg.png"
              alt="Vista Valle Lodging House"
              fill
              sizes="100vw"
              className="object-cover"
            />
            <div className="vv-panorama-overlay absolute inset-0 flex items-center justify-center px-4 text-center">
              <div className="space-y-5">
                <h2 className="font-heading text-display font-normal text-on-primary">
                  {content.location.title}
                </h2>
                <ActionLink
                  href="#consulta-disponibilidad"
                  variant="action"
                  className="!rounded-[0.2rem] !bg-primary !font-heading !font-semibold !text-on-primary hover:!bg-primary active:!bg-primary"
                >
                  Reservar ahora
                </ActionLink>
              </div>
            </div>
          </section>
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
