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
    { href: "#ubicacion", label: "Ubicación" },
    { href: "#contacto", label: "Contacto" },
  ] satisfies readonly PublicNavigationItem[],
  hero: {
    eyebrow: "Illapel · Valle del Choapa",
    title: "Un lugar para bajar el ritmo.",
    copy: "Comodidad, tranquilidad y una vista privilegiada para descansar después del camino.",
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
  services: {
    title: "Servicios",
    items: [],
    emptyMessage:
      "Los servicios se publicarán cuando su información esté aprobada.",
  },
  experience: {
    title: "Vista y experiencia",
    copy: "La información sobre la experiencia y sus imágenes se publicará cuando esté aprobada.",
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
  location: {
    title: "Tu próxima estadía comienza aquí.",
  },
  contact: {
    title: "Contacto",
    copy: "Los canales de contacto se publicarán cuando estén configurados y aprobados.",
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
      { href: "#ubicacion", label: "Ubicación" },
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
        href: "mailto:hola@vistavalle.cl",
        label: "hola@vistavalle.cl",
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
