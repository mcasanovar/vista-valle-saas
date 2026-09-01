import { getAvailabilitySearchRepository } from "@/features/availability/search-source";
import {
  CompanyQuotationAvailabilityInputError,
  resolveCompanyQuotationAvailability,
} from "@/features/company-quotations";
import { getRoomReadSource } from "@/features/rooms";

export async function GET(request: Request) {
  const search = request.url
    ? new URL(request.url).searchParams
    : new URLSearchParams();
  try {
    const result = await resolveCompanyQuotationAvailability(
      {
        checkIn: search.get("checkIn"),
        checkOut: search.get("checkOut"),
        guestCount: search.get("guestCount"),
      },
      {
        availabilityRepository: getAvailabilitySearchRepository(),
        roomSource: await getRoomReadSource(),
      }
    );
    return Response.json(result);
  } catch (error) {
    if (error instanceof CompanyQuotationAvailabilityInputError) {
      return Response.json(
        { code: error.code, message: error.message },
        { status: 400 }
      );
    }
    return Response.json(
      {
        code: "COMPANY_QUOTATION_AVAILABILITY_FAILED",
        message: "No pudimos calcular la disponibilidad. Intenta nuevamente.",
      },
      { status: 500 }
    );
  }
}
