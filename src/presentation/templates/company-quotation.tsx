import { Heading, Text } from "@/presentation/atoms";
import {
  CompanyQuotationController,
  PublicFooter,
  PublicHeader,
} from "@/presentation/organisms";
import { publicSiteContent } from "@/config/public-site-content";

const navigation = [
  { href: "/", label: "Inicio" },
  { href: "/habitaciones", label: "Habitaciones" },
  { href: "/#nosotros", label: "Nosotros" },
  { href: "/#empresas", label: "Empresas" },
  { href: "/#ubicacion", label: "Ubicación" },
] as const;

export function CompanyQuotationTemplate() {
  return (
    <>
      <PublicHeader
        brandLabel={publicSiteContent.brandLabel}
        homeHref="/"
        items={navigation}
        bookingHref="/disponibilidad"
        bookingLabel="Reserva"
      />
      <main id="main-content" className="bg-warm">
        <header className="border-b border-border bg-card">
          <div className="mx-auto max-w-content space-y-4 px-4 py-12 phone:px-6 tablet:px-8 tablet:py-16">
            <p className="text-label font-semibold uppercase tracking-[0.18em] text-accent">
              Empresas
            </p>
            <Heading level={1}>Solicita una cotización para tu empresa</Heading>
            <Text className="max-w-prose text-muted-foreground">
              Selecciona las fechas, personas y habitaciones que necesitas.
              Calcularemos el valor total y enviaremos el resumen al correo
              indicado.
            </Text>
          </div>
        </header>
        <article className="mx-auto max-w-content space-y-8 px-4 py-10 phone:px-6 tablet:px-8 tablet:py-14">
          <div className="rounded-lg border border-accent/40 bg-accent/10 p-4">
            <p className="text-sm text-foreground">
              <strong>Importante:</strong> las capacidades y precios actuales
              son datos de demostración para validar esta experiencia.
            </p>
          </div>
          <CompanyQuotationController />
        </article>
      </main>
      <PublicFooter
        brandDescription={publicSiteContent.footer.brandDescription}
        socials={publicSiteContent.footer.socials}
        navigation={publicSiteContent.footer.navigation}
        contacts={publicSiteContent.footer.contacts}
        whatsapp={publicSiteContent.footer.whatsapp}
        copyright={publicSiteContent.footer.copyright}
      />
    </>
  );
}
