import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPublicBookingConfirmation } from "@/features/reservations/confirm-pay-at-property";
import { BookingConfirmationView } from "@/features/reservations/booking-confirmation-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirmación de reserva",
  robots: { index: false, follow: false },
};

export default async function BookingConfirmationPage({
  params,
}: Readonly<{ params: Promise<{ publicId: string }> }>) {
  const { publicId } = await params;
  const confirmation = await getPublicBookingConfirmation(publicId);
  if (!confirmation) notFound();

  return <BookingConfirmationView confirmation={confirmation} />;
}
