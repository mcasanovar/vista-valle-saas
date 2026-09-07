import Image from "next/image";
import {
  ActionLink,
  Heading,
  Icon,
  Text,
  type IconName,
} from "@/presentation/atoms";
import { ContactLink, type ContactHref } from "@/presentation/molecules";
import { InteractiveSurface } from "./motion";
import {
  VistaValleBrandWhite,
  VistaValleBrandWithoutText,
} from "../atoms/atoms";

type SectionProps = Readonly<{ id?: string; title: string; copy: string }>;

export function PendingContentSection({ id, title, copy }: SectionProps) {
  return (
    <section
      id={id}
      className="mx-auto max-w-content space-y-4 px-4 py-10 phone:px-6 tablet:px-8 tablet:py-14"
    >
      <Heading level={2}>{title}</Heading>
      <Text className="max-w-prose text-muted-foreground">{copy}</Text>
    </section>
  );
}

export function CompanyCta({
  id,
  title,
  copy,
  href,
  label,
  ctaHref,
  ctaLabel,
  image,
}: {
  href?: ContactHref;
  label?: string;
  ctaHref?: string;
  ctaLabel?: string;
  image?: { src: string };
} & SectionProps) {
  return (
    <section id={id} className="relative isolate overflow-hidden bg-primary">
      {image ? (
        <>
          <Image
            src={image.src}
            alt=""
            aria-hidden="true"
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(0deg, rgb(11 10 16 / 0.9), rgb(11 10 16 / 0.55) 55%, rgb(11 10 16 / 0.25))",
            }}
          />
        </>
      ) : null}
      <div className="relative mx-auto flex max-w-content flex-col items-start gap-6 px-4 py-10 phone:px-6 tablet:flex-row tablet:items-center tablet:justify-between tablet:gap-8 tablet:px-8 tablet:py-14">
        <div className="flex min-w-0 flex-col gap-4 tablet:flex-row tablet:items-center tablet:gap-6">
          <Icon
            decorative
            name="Briefcase"
            className="size-24 shrink-0 rounded-full border-2 border-on-primary/60 p-6 text-on-primary"
          />
          <div className="space-y-2">
            <Heading level={2} className="!text-on-primary">
              {title}
            </Heading>
            <Text className="max-w-prose !text-on-primary/85">{copy}</Text>
          </div>
        </div>
        {href && label ? <ContactLink href={href}>{label}</ContactLink> : null}
        {ctaHref && ctaLabel ? (
          <InteractiveSurface>
            <ActionLink
              href={ctaHref}
              variant="action"
              className="!bg-gold !text-on-gold hover:!bg-gold active:!bg-gold"
            >
              {ctaLabel}
            </ActionLink>
          </InteractiveSurface>
        ) : null}
        {!href && !ctaHref ? (
          <Text className="!text-on-primary/70">
            Canal de contacto pendiente de configuración.
          </Text>
        ) : null}
      </div>
    </section>
  );
}

export function LocationSection({ id, title }: { title: string; id?: string }) {
  return (
    <section
      id={id}
      className="mx-auto max-w-content space-y-4 px-4 py-10 text-center phone:px-6 tablet:px-8 tablet:py-14"
    >
      <VistaValleBrandWithoutText className="mx-auto !h-auto !w-16" />
      <Heading level={2}>{title}</Heading>
      <InteractiveSurface>
        <ActionLink
          href="#consulta-disponibilidad"
          variant="action"
          className="!bg-gold !text-on-gold hover:!bg-gold active:!bg-gold"
        >
          Reservar ahora
        </ActionLink>
      </InteractiveSurface>
    </section>
  );
}
export function FinalCta({
  id,
  title,
  copy,
  href,
  label,
}: {
  href: string;
  label: string;
} & SectionProps) {
  return (
    <section
      id={id}
      className="mx-auto max-w-content space-y-4 px-4 py-10 phone:px-6 tablet:px-8 tablet:py-14"
    >
      <Heading level={2}>{title}</Heading>
      <Text className="max-w-prose">{copy}</Text>
      <InteractiveSurface>
        <ActionLink href={href} variant="action">
          {label}
        </ActionLink>
      </InteractiveSurface>
    </section>
  );
}
export function WhatsAppContact({
  href,
  label,
}: {
  href: `https://${string}`;
  label: string;
}) {
  return (
    <ContactLink href={href} icon="MessageCircle">
      {label}
    </ContactLink>
  );
}
export function PublicFooter({
  brandDescription,
  socials,
  navigation,
  contacts,
  whatsapp,
  copyright,
}: {
  brandDescription: string;
  socials: readonly { id: string; href: string; icon: IconName }[];
  navigation: readonly { href: string; label: string }[];
  contacts: readonly {
    id: string;
    href: ContactHref;
    label: string;
    icon: IconName;
  }[];
  whatsapp: {
    href: ContactHref;
    label: string;
    description: string;
    icon: IconName;
  };
  copyright: string;
}) {
  return (
    <footer className="border-t border-primary bg-primary text-on-primary">
      <div className="mx-auto grid max-w-content gap-8 px-4 py-10 phone:px-6 tablet:grid-cols-4 tablet:px-8 relative">
        <div className="space-y-4">
          <VistaValleBrandWhite />
          <Text className="text-xs text-on-primary/75">{brandDescription}</Text>
          <ul className="flex gap-4">
            {socials.map((social) => (
              <li key={social.id}>
                <a href={social.href} aria-label={social.id}>
                  <Icon decorative name={social.icon} className="size-6" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="absolute top-0 left-1/4 h-full w-px bg-on-primary/20" />
        <div className="pl-6">
          <p className="font-heading text-lg font-normal leading-snug text-primary font-semibold text-xs text-white/75">
            Navegación
          </p>
          <ul className="mt-4 space-y-2">
            {navigation.map((item) => (
              <li key={item.href}>
                <ActionLink className="text-white/75" href={item.href}>
                  {item.label}
                </ActionLink>
              </li>
            ))}
          </ul>
        </div>

        <div className="absolute top-0 left-2/4 h-full w-px bg-on-primary/20" />
        <div className="pl-6">
          <p className="font-heading text-lg font-normal leading-snug text-primary font-semibold text-xs text-white/75">
            Contacto
          </p>
          <ul className="mt-4 space-y-2">
            {contacts.map((contact) => (
              <li key={contact.id}>
                <ContactLink href={contact.href} icon={contact.icon}>
                  {contact.label}
                </ContactLink>
              </li>
            ))}
          </ul>
        </div>

        <div className="absolute top-0 left-3/4 h-full w-px bg-on-primary/20" />
        <div className="pl-6">
          <p className="font-heading text-lg font-normal leading-snug text-primary font-semibold text-xs text-white/75">
            WhatsApp
          </p>
          <ul className="mt-4 space-y-2">
            <li>
              <ContactLink href={whatsapp.href} icon={whatsapp.icon}>
                {whatsapp.label}
              </ContactLink>
            </li>
          </ul>
          <Text className="mt-4 text-xs text-on-primary/75">
            {whatsapp.description}
          </Text>
        </div>
      </div>
      <div className="px-4 py-4 phone:px-6 tablet:px-8">
        <Text className="mx-auto max-w-content text-label text-on-primary/75 text-center">
          {copyright}
        </Text>
      </div>
    </footer>
  );
}
