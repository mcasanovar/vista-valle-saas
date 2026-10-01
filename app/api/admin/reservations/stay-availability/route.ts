import {
  getStayEditAvailability,
  StayEditAvailabilityAuthorizationError,
  StayEditAvailabilityInputError,
} from "@/features/admin/stay-edit-availability";

export const dynamic = "force-dynamic";

/**
 * Rooms selectable for editing one reservation's stay. Unlike the manual
 * reservation availability route, this one applies no minimum-date rule and
 * excludes the edited reservation's own occupancy, so a stay already under
 * way can be edited and its current rooms come back as available.
 */
export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const reservationId = search.get("reservationId");
  try {
    return Response.json(
      await getStayEditAvailability({
        checkIn: search.get("checkIn"),
        checkOut: search.get("checkOut"),
        ...(reservationId ? { excludeReservationId: reservationId } : {}),
      })
    );
  } catch (error) {
    if (error instanceof StayEditAvailabilityAuthorizationError) {
      return Response.json({ message: "No autorizado." }, { status: 401 });
    }
    if (error instanceof StayEditAvailabilityInputError) {
      return Response.json(
        { code: error.code, message: error.message },
        { status: 400 }
      );
    }
    return Response.json(
      { message: "No pudimos consultar disponibilidad. Intenta nuevamente." },
      { status: 500 }
    );
  }
}
