import type { RoomReadModel } from "./read-model";

export const mockDemoRooms: readonly RoomReadModel[] = Object.freeze([
  Object.freeze({
    active: true,
    amenities: ["Wi‑Fi", "Calefacción", "Desayuno de demostración"],
    bathroom: "Baño privado de demostración con ducha.",
    bedConfiguration: "1 cama matrimonial",
    capacity: 1,
    description:
      "Habitación ficticia de demostración para validar la presentación del catálogo.",
    id: "demo-room-valle",
    images: [
      {
        alt: "Imagen de demostración para la habitación Valle",
        id: "demo-valle-hero",
        src: "/rooms/room-1.jpeg",
      },
      {
        alt: "Segunda imagen de demostración para la habitación Valle",
        id: "demo-valle-2",
        src: "/rooms/room-2.jpeg",
      },
      {
        alt: "Tercera imagen de demostración para la habitación Valle",
        id: "demo-valle-3",
        src: "/rooms/room-3.jpeg",
      },
    ],
    isDemonstration: true,
    name: "Habitación Individual",
    nightlyPriceClp: 55000,
    occupancyPrices: [],
    slug: "habitacion-valle-demo",
  }),
  Object.freeze({
    active: true,
    amenities: ["Wi‑Fi", "Espacio de trabajo", "Desayuno de demostración"],
    bathroom: "Baño privado de demostración con ducha.",
    bedConfiguration: "2 camas individuales",
    capacity: 1,
    description:
      "Habitación ficticia de demostración para revisar contenido, capacidad y precio.",
    id: "demo-room-andes",
    images: [
      {
        alt: "Imagen de demostración para la habitación Andes",
        id: "demo-andes-hero",
        src: "/rooms/room-2.jpeg",
      },
    ],
    isDemonstration: true,
    name: "Habitación Matrimonial",
    nightlyPriceClp: 60000,
    occupancyPrices: [],
    slug: "habitacion-andes-demo",
  }),
  Object.freeze({
    active: true,
    amenities: ["Wi‑Fi", "Calefacción", "Espacio para equipaje"],
    bathroom: "Baño privado de demostración con ducha.",
    bedConfiguration: "1 cama queen y 1 cama individual",
    capacity: 2,
    description:
      "Habitación ficticia de demostración para validar el detalle de una capacidad mayor.",
    id: "demo-room-terra",
    images: [
      {
        alt: "Imagen de demostración para la habitación Terra",
        id: "demo-terra-hero",
        src: "/rooms/room-3.jpeg",
      },
    ],
    isDemonstration: true,
    name: "Habitación Doble",
    nightlyPriceClp: 70000,
    occupancyPrices: [
      { occupancy: 1, priceClp: 55000 },
      { occupancy: 2, priceClp: 70000 },
    ],
    slug: "habitacion-terra-demo",
  }),
]);
