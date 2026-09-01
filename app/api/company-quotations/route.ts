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
  getNotificationOutboxWriter,
  getScheduledOutboxProcessor,
} from "@/features/notifications";
import { getServerCompanyQuotationRepository } from "@/infrastructure/database/company-quotation-source";
import { getServerEnvironment } from "@/config/server";
import { getRoomReadSource } from "@/features/rooms";

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
    const quotation = calculateCompanyQuotation(
      input,
      roomSource.listActive()
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
    const repository = getServerCompanyQuotationRepository();
    const writer = getNotificationOutboxWriter();
    if (!repository || !writer) {
      return Response.json(
        {
          code: "QUOTATION_UNAVAILABLE",
          message: "La cotización no está disponible en este momento.",
        },
        { status: 503 }
      );
    }

    const record = await repository.create(quotation, idempotencyKey);
    await writer.writeCompanyQuotationRequested(undefined, {
      quotation: record,
    });
    if (getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT === "mock") {
      await getScheduledOutboxProcessor()?.run();
    }
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
