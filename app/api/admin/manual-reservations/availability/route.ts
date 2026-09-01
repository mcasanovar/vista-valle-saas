import {
  getManualReservationAvailability,
  ManualReservationAvailabilityAuthorizationError,
  ManualReservationAvailabilityInputError,
} from "@/features/admin/manual-reservation-availability";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  try {
    return Response.json(
      await getManualReservationAvailability({
        checkIn: search.get("checkIn"),
        checkOut: search.get("checkOut"),
      })
    );
  } catch (error) {
    if (error instanceof ManualReservationAvailabilityAuthorizationError) {
      return Response.json({ message: "No autorizado." }, { status: 401 });
    }
    if (error instanceof ManualReservationAvailabilityInputError) {
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
