import { Heading, Text } from "@/presentation/atoms";
import {
  CompanyQuotationController,
  PublicFooter,
  PublicHeader,
} from "@/presentation/organisms";
import {
  publicNavigationForRoute,
  publicSiteContent,
} from "@/config/public-site-content";

const navigation = publicNavigationForRoute(false);

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
      <main id="main-content" className="vv-quotation-page bg-background">
        <header className="vv-quotation-hero">
          <div className="vv-quotation-hero-inner mx-auto max-w-content space-y-4 px-4 phone:px-6 tablet:px-8">
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
        <article className="vv-quotation-content mx-auto max-w-content space-y-8 px-4 phone:px-6 tablet:px-8">
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
