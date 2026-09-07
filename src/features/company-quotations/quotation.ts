import {
  createLodgingInterval,
  type LodgingInterval,
  nights,
} from "@/features/availability";
import type { RoomReadModel } from "@/features/rooms";

export type CompanyQuotationRoomSelection = Readonly<{
  quantity: number;
  slug: string;
}>;

export type CompanyQuotationBreakfastCatalog = Readonly<{
  description: string;
  unitPriceClp: number;
}>;

export type CompanyQuotationInput = Readonly<{
  breakfastQuantity?: number;
  breakfastRequested: boolean;
  checkIn: string;
  checkOut: string;
  company: string;
  contact: string;
  email: string;
  guestCount: number;
  message: string;
  phone?: string;
  requireParking: boolean;
  rooms: readonly CompanyQuotationRoomSelection[];
}>;

export type CompanyQuotationLine = Readonly<{
  capacity: number;
  name: string;
  nightlyPriceClp: number;
  nights: number;
  quantity: number;
  slug: string;
  subtotalClp: number;
}>;

export type CompanyQuotation = Readonly<{
  breakfastQuantity?: number;
  breakfastRequested: boolean;
  breakfastSubtotalClp: number;
  breakfastUnitPriceClp?: number;
  capacity: number;
  checkIn: string;
  checkOut: string;
  company: string;
  contact: string;
  email: string;
  guestCount: number;
  lines: readonly CompanyQuotationLine[];
  message: string;
  nights: number;
  phone: string;
  requireParking: boolean;
  totalClp: number;
}>;

export type CompanyQuotationIssue = Readonly<{
  field: string;
  message: string;
}>;

export class CompanyQuotationInputError extends Error {
  readonly code = "INVALID_COMPANY_QUOTATION_INPUT" as const;

  constructor(readonly issues: readonly CompanyQuotationIssue[]) {
    super("La solicitud de cotización no es válida.");
    this.name = "CompanyQuotationInputError";
  }
}

export class CompanyQuotationRoomError extends Error {
  readonly code = "COMPANY_QUOTATION_ROOM_UNAVAILABLE" as const;

  constructor(readonly slug: string) {
    super("Una de las habitaciones seleccionadas no está disponible.");
    this.name = "CompanyQuotationRoomError";
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function uniqueSelections(
  selections: readonly CompanyQuotationRoomSelection[]
) {
  return (
    new Set(selections.map((selection) => selection.slug)).size ===
    selections.length
  );
}

export function normalizeCompanyQuotationInput(
  value: unknown
): CompanyQuotationInput {
  const candidate =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const issues: CompanyQuotationIssue[] = [];
  const rooms = Array.isArray(candidate.rooms)
    ? candidate.rooms.map((room) => ({
        quantity:
          typeof room === "object" && room !== null
            ? (room as Record<string, unknown>).quantity
            : undefined,
        slug:
          typeof room === "object" && room !== null
            ? text((room as Record<string, unknown>).slug)
            : "",
      }))
    : [];

  for (const field of [
    "checkIn",
    "checkOut",
    "company",
    "contact",
    "email",
    "message",
  ] as const) {
    if (!text(candidate[field]))
      issues.push({ field, message: "Este campo es obligatorio." });
  }
  if (!/^\S+@\S+\.\S+$/.test(text(candidate.email))) {
    issues.push({
      field: "email",
      message: "Ingrese un correo electrónico válido.",
    });
  }
  if (!positiveInteger(candidate.guestCount)) {
    issues.push({
      field: "guestCount",
      message: "Indique una cantidad válida de personas.",
    });
  }
  if (typeof candidate.requireParking !== "boolean") {
    issues.push({
      field: "requireParking",
      message: "Indique si requiere estacionamiento.",
    });
  }
  const breakfastRequested = candidate.breakfastRequested === true;
  if (breakfastRequested && !positiveInteger(candidate.breakfastQuantity)) {
    issues.push({
      field: "breakfastQuantity",
      message: "Indique una cantidad válida de desayunos.",
    });
  }
  if (!rooms.length) {
    issues.push({
      field: "rooms",
      message: "Seleccione al menos una habitación.",
    });
  } else if (!uniqueSelections(rooms as CompanyQuotationRoomSelection[])) {
    issues.push({
      field: "rooms",
      message: "Cada tipo de habitación debe aparecer una sola vez.",
    });
  }
  rooms.forEach((room, index) => {
    if (!room.slug)
      issues.push({
        field: `rooms.${index}.slug`,
        message: "Seleccione una habitación válida.",
      });
    if (!positiveInteger(room.quantity)) {
      issues.push({
        field: `rooms.${index}.quantity`,
        message: "Indique una cantidad válida de habitaciones.",
      });
    }
  });
  if (issues.length)
    throw new CompanyQuotationInputError(Object.freeze(issues));

  return Object.freeze({
    breakfastQuantity: breakfastRequested
      ? (candidate.breakfastQuantity as number)
      : undefined,
    breakfastRequested,
    checkIn: text(candidate.checkIn),
    checkOut: text(candidate.checkOut),
    company: text(candidate.company),
    contact: text(candidate.contact),
    email: text(candidate.email).toLowerCase(),
    guestCount: candidate.guestCount as number,
    message: text(candidate.message),
    phone: text(candidate.phone),
    requireParking: candidate.requireParking === true,
    rooms: Object.freeze(rooms as CompanyQuotationRoomSelection[]),
  });
}

export function calculateCompanyQuotation(
  input: CompanyQuotationInput,
  activeRooms: readonly RoomReadModel[],
  breakfastCatalog: CompanyQuotationBreakfastCatalog | null = null
): CompanyQuotation {
  let interval: LodgingInterval;
  try {
    interval = createLodgingInterval(input.checkIn, input.checkOut);
  } catch {
    throw new CompanyQuotationInputError([
      { field: "checkIn", message: "Indique un intervalo de fechas válido." },
      {
        field: "checkOut",
        message: "La salida debe ser posterior a la entrada.",
      },
    ]);
  }

  const roomBySlug = new Map(
    activeRooms.filter((room) => room.active).map((room) => [room.slug, room])
  );
  const stayNights = nights(interval.checkIn, interval.checkOut);
  const lines = input.rooms.map((selection) => {
    const room = roomBySlug.get(selection.slug);
    if (!room) throw new CompanyQuotationRoomError(selection.slug);
    const subtotalClp = selection.quantity * room.nightlyPriceClp * stayNights;
    if (!Number.isSafeInteger(subtotalClp))
      throw new CompanyQuotationInputError([
        { field: "rooms", message: "El total calculado no es válido." },
      ]);
    return Object.freeze({
      capacity: room.capacity,
      name: room.name,
      nightlyPriceClp: room.nightlyPriceClp,
      nights: stayNights,
      quantity: selection.quantity,
      slug: room.slug,
      subtotalClp,
    });
  });
  const capacity = lines.reduce(
    (sum, line) => sum + line.capacity * line.quantity,
    0
  );

  if (input.breakfastRequested && !breakfastCatalog) {
    throw new CompanyQuotationInputError([
      {
        field: "breakfastQuantity",
        message: "El desayuno no está disponible en este momento.",
      },
    ]);
  }
  const breakfastSubtotalClp = input.breakfastRequested
    ? (input.breakfastQuantity as number) * breakfastCatalog!.unitPriceClp
    : 0;
  if (!Number.isSafeInteger(breakfastSubtotalClp))
    throw new CompanyQuotationInputError([
      {
        field: "breakfastQuantity",
        message: "El total calculado no es válido.",
      },
    ]);

  const roomsTotalClp = lines.reduce((sum, line) => sum + line.subtotalClp, 0);

  return Object.freeze({
    breakfastQuantity: input.breakfastRequested
      ? input.breakfastQuantity
      : undefined,
    breakfastRequested: input.breakfastRequested,
    breakfastSubtotalClp,
    breakfastUnitPriceClp: input.breakfastRequested
      ? breakfastCatalog!.unitPriceClp
      : undefined,
    capacity,
    checkIn: interval.checkIn,
    checkOut: interval.checkOut,
    company: input.company,
    contact: input.contact,
    email: input.email,
    guestCount: input.guestCount,
    lines: Object.freeze(lines),
    message: input.message,
    nights: stayNights,
    phone: input.phone ?? "",
    requireParking: input.requireParking,
    totalClp: roomsTotalClp + breakfastSubtotalClp,
  });
}
