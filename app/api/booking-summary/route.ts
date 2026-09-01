import {
  buildBookingSummary,
  BookingSummaryInputError,
} from "@/features/reservations";
import { getRoomReadSource } from "@/features/rooms";
export async function GET(request: Request) {
  try {
    return Response.json(
      buildBookingSummary(
        Object.fromEntries(new URL(request.url).searchParams),
        await getRoomReadSource()
      )
    );
  } catch (error) {
    return Response.json(
      {
        message:
          error instanceof BookingSummaryInputError
            ? error.message
            : "No pudimos preparar el resumen. Revisa tus datos.",
      },
      { status: error instanceof BookingSummaryInputError ? 400 : 500 }
    );
  }
}
