import {
  compareLodgingDates,
  createLodgingInterval,
  parseLodgingDate,
  publicAvailabilityDateMinimums,
  type LodgingDate,
} from "./date-only";

const MAX_GUESTS = 20;
const MAX_ROOM_IDENTIFIER_LENGTH = 120;
const ROOM_IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export type AvailabilityResultsQuery = Readonly<{
  checkIn: LodgingDate;
  checkOut: LodgingDate;
  guests: number;
  room?: string;
}>;

export type AvailabilityResultsQueryField =
  | "checkIn"
  | "checkOut"
  | "guests"
  | "room";

export type AvailabilityResultsQueryErrorCode =
  | "MISSING"
  | "MALFORMED"
  | "OUT_OF_RANGE"
  | "NOT_ORDERED";

export type AvailabilityResultsQueryError = Readonly<{
  code: AvailabilityResultsQueryErrorCode;
  field: AvailabilityResultsQueryField;
  message: string;
}>;

export type AvailabilityResultsQueryValidation =
  | Readonly<{ ok: true; value: AvailabilityResultsQuery }>
  | Readonly<{
      ok: false;
      errors: Readonly<
        Partial<
          Record<AvailabilityResultsQueryField, AvailabilityResultsQueryError>
        >
      >;
    }>;

export type AvailabilityResultsSearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

function firstValue(value: string | readonly string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

function hasMultipleValues(value: string | readonly string[] | undefined) {
  return Array.isArray(value);
}

function error(
  field: AvailabilityResultsQueryField,
  code: AvailabilityResultsQueryErrorCode,
  message: string
): AvailabilityResultsQueryError {
  return Object.freeze({ code, field, message });
}

function validateRoom(value: string | undefined) {
  if (value === undefined) return undefined;
  if (
    value.length === 0 ||
    value.length > MAX_ROOM_IDENTIFIER_LENGTH ||
    !ROOM_IDENTIFIER_PATTERN.test(value)
  ) {
    return error(
      "room",
      value.length > MAX_ROOM_IDENTIFIER_LENGTH ? "OUT_OF_RANGE" : "MALFORMED",
      "La habitación seleccionada no es válida."
    );
  }
  return undefined;
}

/**
 * Converts Next.js searchParams into the only query shape accepted by the
 * availability-results page. Date parsing intentionally reuses the lodging
 * interval domain rule so dates retain their date-only semantics.
 */
export function validateAvailabilityResultsQuery(
  searchParams: AvailabilityResultsSearchParams,
  now: Date = new Date()
): AvailabilityResultsQueryValidation {
  const rawCheckIn = firstValue(searchParams.checkIn);
  const rawCheckOut = firstValue(searchParams.checkOut);
  const rawGuests = firstValue(searchParams.guests);
  const rawRoom = firstValue(searchParams.room);
  const errors: Partial<
    Record<AvailabilityResultsQueryField, AvailabilityResultsQueryError>
  > = {};

  if (hasMultipleValues(searchParams.checkIn)) {
    errors.checkIn = error(
      "checkIn",
      "MALFORMED",
      "La fecha de entrada no es válida."
    );
  } else if (rawCheckIn === undefined) {
    errors.checkIn = error("checkIn", "MISSING", "Indica la fecha de entrada.");
  }
  if (hasMultipleValues(searchParams.checkOut)) {
    errors.checkOut = error(
      "checkOut",
      "MALFORMED",
      "La fecha de salida no es válida."
    );
  } else if (rawCheckOut === undefined) {
    errors.checkOut = error(
      "checkOut",
      "MISSING",
      "Indica la fecha de salida."
    );
  }
  if (hasMultipleValues(searchParams.guests)) {
    errors.guests = error(
      "guests",
      "MALFORMED",
      "La cantidad de huéspedes no es válida."
    );
  } else if (rawGuests === undefined) {
    errors.guests = error(
      "guests",
      "MISSING",
      "Indica la cantidad de huéspedes."
    );
  }
  if (hasMultipleValues(searchParams.room)) {
    errors.room = error(
      "room",
      "MALFORMED",
      "La habitación seleccionada no es válida."
    );
  } else {
    const roomError = validateRoom(rawRoom);
    if (roomError) errors.room = roomError;
  }

  let interval: ReturnType<typeof createLodgingInterval> | undefined;
  if (!errors.checkIn && !errors.checkOut) {
    try {
      const checkIn = parseLodgingDate(rawCheckIn!);
      const checkOut = parseLodgingDate(rawCheckOut!);
      interval = createLodgingInterval(checkIn, checkOut);
    } catch {
      try {
        parseLodgingDate(rawCheckIn!);
      } catch {
        errors.checkIn = error(
          "checkIn",
          "MALFORMED",
          "La fecha de entrada no es válida."
        );
      }
      try {
        parseLodgingDate(rawCheckOut!);
      } catch {
        errors.checkOut = error(
          "checkOut",
          "MALFORMED",
          "La fecha de salida no es válida."
        );
      }
      if (!errors.checkIn && !errors.checkOut) {
        errors.checkOut = error(
          "checkOut",
          "NOT_ORDERED",
          "La fecha de salida debe ser posterior a la entrada."
        );
      }
    }
  }

  if (interval) {
    const minimums = publicAvailabilityDateMinimums(now);
    if (compareLodgingDates(interval.checkIn, minimums.checkIn) < 0) {
      errors.checkIn = error(
        "checkIn",
        "OUT_OF_RANGE",
        "La fecha de entrada no puede ser anterior a hoy."
      );
    }
    if (compareLodgingDates(interval.checkOut, minimums.checkOut) < 0) {
      errors.checkOut = error(
        "checkOut",
        "OUT_OF_RANGE",
        "La fecha de salida debe ser como mínimo mañana."
      );
    }
  }

  let guests: number | undefined;
  if (!errors.guests && rawGuests !== undefined) {
    if (!/^\d+$/.test(rawGuests)) {
      errors.guests = error(
        "guests",
        "MALFORMED",
        "La cantidad de huéspedes no es válida."
      );
    } else {
      guests = Number(rawGuests);
      if (!Number.isSafeInteger(guests) || guests < 1 || guests > MAX_GUESTS) {
        errors.guests = error(
          "guests",
          "OUT_OF_RANGE",
          `Indica entre 1 y ${MAX_GUESTS} huéspedes.`
        );
      }
    }
  }

  if (Object.keys(errors).length > 0 || !interval || guests === undefined) {
    return Object.freeze({ ok: false, errors: Object.freeze(errors) });
  }

  return Object.freeze({
    ok: true,
    value: Object.freeze({
      checkIn: interval.checkIn,
      checkOut: interval.checkOut,
      guests,
      ...(rawRoom ? { room: rawRoom } : {}),
    }),
  });
}

/** Serializes only canonical availability criteria, never arbitrary URL data. */
export function serializeAvailabilityResultsQuery(
  query: AvailabilityResultsQuery
) {
  const validation = validateAvailabilityResultsQuery({
    checkIn: query.checkIn,
    checkOut: query.checkOut,
    guests: String(query.guests),
    ...(query.room === undefined ? {} : { room: query.room }),
  });
  if (!validation.ok) {
    throw new TypeError(
      "Cannot serialize an invalid availability results query"
    );
  }

  const params = new URLSearchParams({
    checkIn: validation.value.checkIn,
    checkOut: validation.value.checkOut,
    guests: String(validation.value.guests),
  });
  if (validation.value.room) params.set("room", validation.value.room);
  return `/disponibilidad?${params.toString()}`;
}
