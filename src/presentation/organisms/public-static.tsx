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
}: {
  href?: ContactHref;
  label?: string;
  ctaHref?: string;
  ctaLabel?: string;
} & SectionProps) {
  return (
    <section id={id} className="vv-company relative isolate overflow-hidden">
      <div className="relative mx-auto grid max-w-content items-center gap-8 px-4 py-14 phone:px-6 tablet:grid-cols-2 tablet:px-8 tablet:py-20 laptop:px-12">
        <div className="space-y-4">
          <Text className="!text-label font-semibold uppercase tracking-[0.18em] !text-accent">
            Para empresas y equipos
          </Text>
          <div className="space-y-3">
            <Heading level={2} className="!text-foreground">
              {title}
            </Heading>
            <Text className="max-w-prose !text-muted-foreground">{copy}</Text>
          </div>
          {href && label ? <ContactLink href={href}>{label}</ContactLink> : null}
          {ctaHref && ctaLabel ? (
            <InteractiveSurface>
              <ActionLink href={ctaHref} variant="action">
                {ctaLabel}
              </ActionLink>
            </InteractiveSurface>
          ) : null}
          {!href && !ctaHref ? (
            <Text className="!text-muted-foreground">
              Canal de contacto pendiente de configuración.
            </Text>
          ) : null}
        </div>
        <div className="vv-company-image" aria-hidden="true" />
      </div>
    </section>
  );
}

export function LocationSection({ id, title }: { title: string; id?: string }) {
  return (
    <section
      id={id}
      className="vv-location mx-auto max-w-content space-y-4 px-4 py-16 text-center phone:px-6 tablet:px-8 tablet:py-24"
    >
      <VistaValleBrandWithoutText className="mx-auto !h-auto !w-16" />
      <Heading level={2}>{title}</Heading>
      <InteractiveSurface>
        <ActionLink
          href="#consulta-disponibilidad"
          variant="action"
          className="!bg-primary !font-heading !font-semibold !text-on-primary hover:!bg-primary active:!bg-primary"
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
    <footer className="vv-public-footer bg-primary text-on-primary">
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

        <div className="absolute top-0 left-1/4 hidden h-full w-px bg-on-primary/20 tablet:block" />
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

        <div className="absolute top-0 left-2/4 hidden h-full w-px bg-on-primary/20 tablet:block" />
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

        <div className="absolute top-0 left-3/4 hidden h-full w-px bg-on-primary/20 tablet:block" />
        <div id="contacto" className="pl-6 scroll-mt-24">
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
