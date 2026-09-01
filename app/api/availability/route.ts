import {
  AvailabilitySearchInputError,
  searchAvailability,
  SelectedRoomUnavailableError,
} from "@/features/availability/search";
import { getAvailabilitySearchRepository } from "@/features/availability/search-source";
import { getRoomReadSource } from "@/features/rooms";

export async function GET(request: Request) {
  const search = request.url
    ? new URL(request.url).searchParams
    : new URLSearchParams();
  try {
    const result = await searchAvailability(
      {
        checkIn: search.get("checkIn"),
        checkOut: search.get("checkOut"),
        guests: search.get("guests"),
        room: search.get("room"),
      },
      {
        availabilityRepository: getAvailabilitySearchRepository(),
        roomSource: await getRoomReadSource(),
      }
    );
    return Response.json(result);
  } catch (error) {
    if (
      error instanceof AvailabilitySearchInputError ||
      error instanceof SelectedRoomUnavailableError
    ) {
      return Response.json(
        { code: error.code, message: error.message },
        { status: 400 }
      );
    }
    return Response.json(
      {
        code: "AVAILABILITY_SEARCH_FAILED",
        message: "No pudimos consultar disponibilidad. Intenta nuevamente.",
      },
      { status: 500 }
    );
  }
}
