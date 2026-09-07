import { Heading, Text } from "@/presentation/atoms";
import {
  publicNavigationForRoute,
  publicSiteContent,
} from "@/config/public-site-content";
import {
  LocationMapLoader,
  PublicFooter,
  PublicHeader,
} from "@/presentation/organisms";

const navigation = publicNavigationForRoute(false);

export function LocationTemplate() {
  const { location } = publicSiteContent;

  return (
    <>
      <PublicHeader
        brandLabel={publicSiteContent.brandLabel}
        homeHref="/"
        items={navigation}
        bookingHref="/#consulta-disponibilidad"
        bookingLabel="Reservar"
      />
      <main id="main-content" className="vv-location-page bg-background">
        <section className="mx-auto max-w-content space-y-7 px-4 py-10 phone:px-6 tablet:px-8 tablet:py-14">
          <div className="max-w-prose space-y-3">
            <Heading level={1}>Ubicación</Heading>
            <Text className="text-muted-foreground">
              Ubica el hostal en Illapel, su relación con la Plaza de Armas y
              cómo llegar.
            </Text>
          </div>
          <LocationMapLoader
            hostal={location.hostal}
            plazaDeArmas={location.plazaDeArmas}
            route={location.route}
          />
          <div className="grid gap-7 tablet:grid-cols-2">
            <div className="space-y-2">
              <Heading level={2}>La ciudad</Heading>
              <Text className="text-muted-foreground">{location.cityInfo}</Text>
            </div>
            <div className="space-y-2">
              <Heading level={2}>Cómo llegar</Heading>
              <Text className="text-muted-foreground">
                {location.transportInfo}
              </Text>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter {...publicSiteContent.footer} />
    </>
  );
}
