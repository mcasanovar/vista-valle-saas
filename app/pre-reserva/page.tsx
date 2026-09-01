import type { Metadata } from "next";
import { ActionLink, Feedback, Heading } from "@/presentation/atoms";
import {
  composePrebookingReview,
  isBookingAcceptanceEnabled,
  PrebookingReviewController,
  PrebookingSelectionRestore,
} from "@/features/reservations";

export const metadata: Metadata = {
  title: "Revisa tu reserva",
  alternates: { canonical: "/pre-reserva" },
  robots: { index: false, follow: true },
};

export default async function PrebookingPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const params = await searchParams;
  const review = await composePrebookingReview(params).catch(() => ({
    kind: "stale" as const,
    message: "No pudimos revalidar tu selección. Vuelve a disponibilidad.",
  }));

  if (review.kind === "ready") {
    return (
      <PrebookingReviewController
        review={review}
        bookingEnabled={isBookingAcceptanceEnabled()}
      />
    );
  }
  const title =
    review.kind === "empty" ? "Tu reserva está vacía" : "Revisa tu selección";
  const message =
    review.kind === "empty"
      ? "Agrega una o más habitaciones desde disponibilidad para continuar."
      : review.message;
  return (
    <main className="min-h-dvh bg-warm">
      <div className="mx-auto max-w-content space-y-5 bg-transparent px-4 py-10 phone:px-6 tablet:px-8">
        <PrebookingSelectionRestore />
        <Heading level={1}>{title}</Heading>
        <Feedback
          variant={review.kind === "empty" ? "info" : "warning"}
          title={title}
        >
          {message}
          <div className="mt-4">
            <ActionLink href="/disponibilidad" variant="action">
              Volver a disponibilidad
            </ActionLink>
          </div>
        </Feedback>
      </div>
    </main>
  );
}
