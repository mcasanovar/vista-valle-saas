import type { PublicNavigationItem } from "@/presentation/organisms";

/**
 * Safe, publishable shell content. Commercial facts remain absent until the
 * owner supplies and approves them for the production content configuration.
 */
export const publicSiteContent = {
  // Kept in sync app-wide: publicNavigationForRoute() is the only place that
  // reads this list, so every public page shares the same nav automatically.
  brandLabel: "Vista Valle",
  navigation: [
    { href: "#inicio", label: "Inicio" },
    { href: "/habitaciones", label: "Habitaciones" },
    { href: "#nosotros", label: "Experiencia" },
    { href: "/ubicacion", label: "Ubicación" },
    { href: "/cotizacion-empresa", label: "Cotizaciones" },
    { href: "#contacto", label: "Contacto" },
  ] satisfies readonly PublicNavigationItem[],
  hero: {
    eyebrow: "Illapel · Valle del Choapa",
    title: "Hospedaje y habitaciones en Illapel",
    copy: "Un lugar para bajar el ritmo.",
    primaryCta: {
      href: "#consulta-disponibilidad",
      label: "Reservar ahora",
    },
    secondaryCta: { href: "/habitaciones", label: "Ver habitaciones" },
    image: {
      src: "/brand/bg-hero.png",
      alt: "Fachada de Vista Valle con montañas nevadas al fondo",
    },
  },
  booking: {
    formLabel: "Consulta de disponibilidad",
    checkInLabel: "Fecha de entrada",
    checkOutLabel: "Fecha de salida",
    guestsLabel: "Huéspedes",
    submitLabel: "Consultar disponibilidad",
  },
  rooms: {
    title: "Nuestras habitaciones",
    copy: "Tres espacios preparados para estadías de trabajo, descanso y viaje.",
  },
  reasons: {
    title: "Lo esencial, bien cuidado.",
    copy: "Una experiencia simple y cercana, pensada para que llegues, descanses y te sientas en casa.",
    items: [
      {
        id: "view",
        label: "Vista privilegiada",
        icon: "Mountain",
        description: "El valle y la montaña como parte de tu estadía.",
      },
      {
        id: "comfort",
        label: "Estacionamiento privado",
        icon: "Car",
        description: "Comodidad y seguridad para tu vehículo.",
      },
      {
        id: "rest",
        label: "Ambiente tranquilo",
        icon: "TreePine",
        description: "Espacios preparados para el descanso.",
      },
      {
        id: "care",
        label: "Atención cercana",
        icon: "User",
        description: "Acompañamiento cuando lo necesites.",
      },
    ],
  },
  // Not currently rendered by any template (public-home.tsx does not wire
  // this section in) — kept here with real, confirmed content instead of a
  // pending marker so it is ready if a future change renders it.
  services: {
    title: "Servicios",
    items: [
      {
        id: "wifi",
        title: "Wi-Fi gratuito",
        description: "Conexión a internet sin costo en todas las habitaciones.",
        icon: "Wifi",
      },
      {
        id: "parking",
        title: "Estacionamiento privado",
        description: "Estacionamiento privado dentro del recinto.",
        icon: "Car",
      },
    ],
  },
  // Not currently rendered by any template — see the note on `services`.
  // Invented placeholder copy pending the owner's own text, in the same
  // spirit as `location.teaserCopy`/`location.cityInfo` below.
  experience: {
    title: "Vista y experiencia",
    copy: "El valle y la montaña de Illapel, a pasos del hostal.",
  },
  company: {
    title: "Tu equipo también necesita descansar.",
    copy: "Soluciones de hospedaje cómodas y convenientes para empresas y trabajadores.",
    contact: undefined,
    quotation: {
      enabled: true,
      href: "/cotizacion-empresa",
      label: "Solicitar cotización",
    },
  },
  /**
   * Stay conditions confirmed directly by the lodging's owner (chat
   * confirmation, 2026-10-03 — see tasks.md 3.2 for the record of what was
   * confirmed and what was omitted). Every field here is published as-is in
   * the page content, the FAQ (5.1) and the structured data (6.1); a field
   * without a confirmed value is left out of this object entirely rather
   * than guessed, per the "Presentación institucional" requirement.
   */
  stayPolicies: {
    // Confirmed by the owner: 15:00 / 12:00.
    checkInTime: "15:00",
    checkOutTime: "12:00",
    // Confirmed by the owner: pets are not accepted.
    petsAllowed: false,
    // Confirmed by the owner: private parking on the property.
    parking: "Estacionamiento privado en el recinto.",
    // Confirmed by the owner: free Wi-Fi.
    wifi: "Wi-Fi gratuito.",
    // Confirmed by the owner, volunteered alongside the policies above.
    houseRules: [
      "No se permite fumar en las habitaciones.",
      "No se permite generar ruidos molestos.",
    ],
    // Breakfast is intentionally omitted: the owner confirmed it is not part
    // of the direct-booking channel this site sells — it is only included in
    // company quotations (see the `company-quotation-breakfast-catalog`
    // capability), which is a different product from a direct room stay.
  },
  /**
   * Official external profiles confirmed by the owner. Only linked via
   * `sameAs` in structured data (6.1) — never used to republish their
   * ratings or reviews (see "Sin aggregateRating propio" in design.md).
   */
  externalProfiles: {
    // Confirmed by the owner.
    booking: {
      href: "https://www.booking.com/hotel/cl/vista-valle.es.html",
      label: "Vista Valle en Booking.com",
    },
    // Tripadvisor and Instagram: not confirmed by the owner yet; omitted
    // rather than guessed.
  },
  location: {
    title: "Tu próxima estadía comienza aquí.",
    // Invented placeholder copy pending the owner's own text — see
    // openspec/changes/add-location-page-map.
    teaserCopy:
      "Illapel te recibe con calma de valle y montaña. Descubre en el mapa cómo llegar desde la Plaza de Armas hasta el hostal.",
    mapCta: {
      href: "/ubicacion",
      label: "Ver mapa y cómo llegar",
    },
    // Geocoded once from a Google Maps pin and OpenStreetMap lookups (see
    // proposal.md); never re-fetched at runtime.
    hostal: {
      position: [-31.630434, -71.1754513],
      label: "Hostal Vista Valle",
    },
    plazaDeArmas: {
      position: [-31.6327658, -71.168334],
      label: "Plaza de Armas de Illapel",
    },
    // Walking route from the Plaza de Armas to the hostal, traced once via
    // OSRM's public foot-routing demo and frozen here as static data — the
    // running app never calls a routing service.
    route: [
      [-31.633118, -71.168065],
      [-31.632939, -71.167743],
      [-31.632887, -71.167641],
      [-31.632151, -71.168192],
      [-31.631363, -71.168776],
      [-31.63183, -71.169648],
      [-31.632295, -71.1705],
      [-31.632771, -71.171366],
      [-31.633246, -71.172248],
      [-31.632837, -71.172599],
      [-31.632747, -71.17267],
      [-31.632656, -71.172738],
      [-31.632534, -71.17282],
      [-31.63247, -71.17286],
      [-31.632402, -71.172891],
      [-31.632334, -71.172911],
      [-31.632211, -71.17294],
      [-31.632119, -71.172953],
      [-31.632027, -71.172963],
      [-31.63191, -71.172969],
      [-31.631794, -71.172969],
      [-31.631029, -71.172901],
      [-31.630999, -71.172898],
      [-31.630968, -71.1729],
      [-31.630942, -71.172905],
      [-31.630916, -71.172912],
      [-31.630883, -71.172929],
      [-31.630853, -71.172953],
      [-31.630831, -71.172981],
      [-31.630814, -71.173013],
      [-31.630927, -71.173958],
      [-31.630965, -71.174606],
      [-31.630948, -71.174704],
      [-31.630905, -71.175005],
      [-31.630261, -71.175288],
      [-31.630353, -71.1755],
    ],
    // Invented placeholder copy pending the owner's own text.
    cityInfo:
      "Illapel es la capital de la provincia del Choapa, en la Región de Coquimbo, rodeada por cerros y el valle que da nombre a la zona. Su Plaza de Armas concentra el comercio, los servicios y la vida del centro de la ciudad, a pocos minutos a pie de la mayoría de los puntos de interés.",
    transportInfo:
      "Illapel se conecta por buses interurbanos que llegan al Terminal de Buses de Illapel, con servicios regulares desde La Serena y Santiago. Dentro de la ciudad, colectivos y taxis cubren los trayectos cortos, y el centro —incluida la Plaza de Armas— es fácilmente recorrible a pie hasta el hostal.",
  },
  // Not currently rendered by any template — see the note on `services`.
  // Real, confirmed content: the same channels already published in
  // `footer.contacts` below.
  contact: {
    title: "Contacto",
    copy: "Escríbenos por teléfono, correo o WhatsApp — te respondemos a la brevedad.",
  },
  finalCta: {
    title: "Planifique su estadía",
    copy: "Puede iniciar una consulta de disponibilidad desde este sitio.",
    href: "#consulta-disponibilidad",
    label: "Consultar disponibilidad",
  },
  footer: {
    brandDescription: "Comodidad, tranquilidad y una vista privilegiada en Illapel.",
    socials: [],
    navigation: [
      { href: "#inicio", label: "Inicio" },
      { href: "/habitaciones", label: "Habitaciones" },
      { href: "#servicios", label: "Servicios" },
      { href: "/ubicacion", label: "Ubicación" },
      { href: "#contacto", label: "Contacto" },
    ],
    contacts: [
      {
        id: "phone",
        href: "tel:+56945981722",
        label: "+56 9 4598 1722",
        icon: "Phone",
      },
      {
        id: "email",
        href: "mailto:hola@vistavallehospedaje.com",
        label: "hola@vistavallehospedaje.com",
        icon: "Mail",
      },
      {
        id: "address",
        href: "https://www.google.com/maps/search/?api=1&query=Flor+de+Mayo+55%2C+Illapel",
        label: "Flor de Mayo #55, Illapel",
        icon: "MapPin",
      },
    ],
    whatsapp: {
      href: "https://wa.me/56945981722",
      label: "+56 9 4598 1722",
      description:
        "Escríbenos directamente por WhatsApp para consultas y reservas.",
      icon: "MessageCircle",
    },
    copyright:
      "© 2026 Vista Valle Lodging House. Todos los derechos reservados.",
  },
} as const;

/**
 * Same header nav everywhere: on the landing page anchors resolve on the
 * current route ("#nosotros"); on any other page they must point back home
 * first ("/#nosotros"). `/habitaciones` is already an absolute path, so it
 * is left untouched.
 */
export function publicNavigationForRoute(
  isHome: boolean,
): readonly PublicNavigationItem[] {
  if (isHome) {
    return publicSiteContent.navigation;
  }

  return publicSiteContent.navigation.map((item) =>
    item.href.startsWith("#") ? { ...item, href: `/${item.href}` } : item,
  );
}

export type StayFaqEntry = Readonly<{
  id: string;
  question: string;
  answer: string;
}>;

/** Only the `stayPolicies` fields a FAQ entry can be built from. */
type StayFaqInput = Readonly<{
  checkInTime?: string;
  checkOutTime?: string;
  parking?: string;
  petsAllowed?: boolean;
  wifi?: string;
}>;

/**
 * Builds the stay FAQ from confirmed `stayPolicies` data only: a field left
 * out of the input (not confirmed, see 3.2) yields no question about it,
 * rather than a question with a guessed answer.
 */
export function buildStayFaq(stay: StayFaqInput): readonly StayFaqEntry[] {
  const entries: StayFaqEntry[] = [];
  if (stay.checkInTime && stay.checkOutTime) {
    entries.push({
      id: "check-in-out",
      question: "¿Cuál es el horario de check-in y check-out?",
      answer: `El check-in es a partir de las ${stay.checkInTime} hrs y el check-out hasta las ${stay.checkOutTime} hrs.`,
    });
  }
  if (stay.parking) {
    entries.push({
      id: "parking",
      question: "¿Hay estacionamiento disponible?",
      answer: stay.parking,
    });
  }
  if (stay.petsAllowed !== undefined) {
    entries.push({
      id: "pets",
      question: "¿Se aceptan mascotas?",
      answer: stay.petsAllowed
        ? "Sí, Vista Valle acepta mascotas."
        : "No, Vista Valle no acepta mascotas.",
    });
  }
  if (stay.wifi) {
    entries.push({
      id: "wifi",
      question: "¿Hay Wi-Fi disponible?",
      answer: stay.wifi,
    });
  }
  return Object.freeze(entries);
}

/** The stay FAQ actually published, derived from the confirmed `stayPolicies`. */
export const publicFaq: readonly StayFaqEntry[] = buildStayFaq(
  publicSiteContent.stayPolicies,
);
