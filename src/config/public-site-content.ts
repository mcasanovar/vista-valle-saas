import type { PublicNavigationItem } from "@/presentation/organisms";

/**
 * Safe, publishable shell content. Commercial facts remain absent until the
 * owner supplies and approves them for the production content configuration.
 */
export const publicSiteContent = {
  brandLabel: "Vista Valle",
  navigation: [
    { href: "#inicio", label: "Inicio" },
    { href: "/habitaciones", label: "Habitaciones" },
    { href: "#servicios", label: "Servicios" },
    { href: "#nosotros", label: "Nosotros" },
    { href: "#empresas", label: "Empresas" },
    { href: "#ubicacion", label: "Ubicación" },
    { href: "#contacto", label: "Contacto" },
    { href: "#consulta-disponibilidad", label: "Reserva" },
  ] satisfies readonly PublicNavigationItem[],
  hero: {
    eyebrow: "Illapel · Valle del Choapa",
    title: "Descansa con una experiencia para recordar",
    copy: "La información definitiva de Vista Valle se encuentra en preparación.",
    primaryCta: {
      href: "#consulta-disponibilidad",
      label: "Reservar ahora",
    },
    secondaryCta: { href: "/habitaciones", label: "Ver habitaciones" },
    image: {
      src: "/brand/bg-hero.jpg",
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
  },
  reasons: {
    title: "Por qué elegir Vista Valle",
    copy: "Las ventajas del alojamiento se publicarán cuando su información esté aprobada.",
    items: [
      {
        id: "view",
        label: "Vista privilegiada",
        icon: "Mountain",
        description: "Disfruta de la mejor vista de Illapel y el valle.",
      },
      {
        id: "comfort",
        label: "Estacionamiento privado",
        icon: "Car",
        description: "Comodidad y seguridad para ti y tu vehículo.",
      },
      {
        id: "rest",
        label: "Ambiente tranquilo",
        icon: "TreePine",
        description: "Espacios diseñados para tu descanso y bienestar.",
      },
      {
        id: "care",
        label: "Atención personalizada",
        icon: "User",
        description: "Te acompañamos en cada detalle de tu estadía.",
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
    title: "Alojamiento para empresas",
    copy: "Soluciones de hospedaje cómodas y convenientes para empresas y trabajadores. Habitaciones equipadas para garantizar buen descanso, cercanas a los principales puntos de la zona",
    contact: undefined,
  },
  location: {
    title: "Tu próxima estadía en Illapel comienza aquí",
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
    brandDescription:
      "Comodidad, tranquilidad y una vista privilegiada para que te sientas como en casa en Illapel.",
    socials: [
      { id: "instagram", href: "https://www.instagram.com/", icon: "MapPin" },
      { id: "facebook", href: "https://www.facebook.com/", icon: "MapPin" },
    ],
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
        href: "tel:+56912345678",
        label: "+56 9 1234 5678",
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
        href: "https://maps.app.goo.gl/m81b5nZ5gGfCF8C87",
        label: "Camino a Cuz Cuz s/n, Illapel, Coquimbo, Chile",
        icon: "MapPin",
      },
    ],
    whatsapp: {
      href: "https://wa.me/56912345678",
      label: "+56 9 1234 5678",
      description:
        "Escríbenos directamente por WhatsApp para consultas y reservas.",
      icon: "MessageCircle",
    },
    copyright:
      "© 2026 Vista Valle Lodging House. Todos los derechos reservados.",
  },
} as const;
