import {
  assertCompanyQuotationRoomsAvailable,
  calculateCompanyQuotation,
  CompanyQuotationAvailabilityExceededError,
  CompanyQuotationInputError,
  CompanyQuotationRoomError,
  normalizeCompanyQuotationInput,
  resolveCompanyQuotationAvailability,
  type CompanyQuotationRecord,
} from "@/features/company-quotations";
import { getAvailabilitySearchRepository } from "@/features/availability/search-source";
import {
  getServerCompanyQuotationBreakfastCatalogRepository,
  getServerCompanyQuotationCreationService,
} from "@/infrastructure/database/company-quotation-source";
import { deliverNotificationsAfterResponse } from "@/infrastructure/database/notification-delivery-trigger";
import { getRoomReadSource } from "@/features/rooms";

// Generous margin over a Resend call plus its internal network retry, so the
// best-effort delivery attempt scheduled via `after()` below has room to
// finish before the invocation is torn down.
export const maxDuration = 30;

function publicQuotation(record: CompanyQuotationRecord) {
  return {
    capacity: record.capacity,
    checkIn: record.checkIn,
    checkOut: record.checkOut,
    guestCount: record.guestCount,
    id: record.id,
    lines: record.lines,
    nights: record.nights,
    totalClp: record.totalClp,
  };
}

export async function POST(request: Request) {
  try {
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 200) {
      return Response.json(
        {
          code: "IDEMPOTENCY_KEY_REQUIRED",
          message: "No pudimos procesar la solicitud.",
        },
        { status: 400 }
      );
    }

    const input = normalizeCompanyQuotationInput(await request.json());
    const roomSource = await getRoomReadSource();
    const breakfastCatalog = input.breakfastRequested
      ? ((await getServerCompanyQuotationBreakfastCatalogRepository()?.get()) ??
        null)
      : null;
    const quotation = calculateCompanyQuotation(
      input,
      roomSource.listActive(),
      breakfastCatalog
    );
    const availability = await resolveCompanyQuotationAvailability(
      {
        checkIn: quotation.checkIn,
        checkOut: quotation.checkOut,
        guestCount: quotation.guestCount,
      },
      {
        availabilityRepository: getAvailabilitySearchRepository(),
        roomSource,
      }
    );
    assertCompanyQuotationRoomsAvailable(input.rooms, availability);
    const creationService = getServerCompanyQuotationCreationService();
    if (!creationService) {
      return Response.json(
        {
          code: "QUOTATION_UNAVAILABLE",
          message: "La cotización no está disponible en este momento.",
        },
        { status: 503 }
      );
    }

    const { notificationOutboxIds, record } = await creationService.create(
      quotation,
      idempotencyKey
    );
    deliverNotificationsAfterResponse(notificationOutboxIds);
    return Response.json(publicQuotation(record), { status: 201 });
  } catch (error) {
    if (error instanceof CompanyQuotationInputError) {
      return Response.json(
        { code: error.code, issues: error.issues, message: error.message },
        { status: 400 }
      );
    }
    if (error instanceof CompanyQuotationRoomError) {
      return Response.json(
        { code: error.code, message: error.message },
        { status: 400 }
      );
    }
    if (error instanceof CompanyQuotationAvailabilityExceededError) {
      return Response.json(
        {
          availableUnits: error.availableUnits,
          code: error.code,
          message: error.message,
          slug: error.slug,
        },
        { status: 400 }
      );
    }
    return Response.json(
      {
        code: "QUOTATION_FAILED",
        message: "No pudimos preparar la cotización. Intenta nuevamente.",
      },
      { status: 500 }
    );
  }
}
