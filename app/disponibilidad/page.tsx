import type { Metadata } from "next";
import { Suspense } from "react";
import {
  AvailabilitySearchController,
  validateAvailabilityResultsQuery,
} from "@/features/availability";
import { AvailabilityResultsTemplate } from "@/presentation/templates";
import {
  AvailabilityResultsData,
  AvailabilityResultsSkeleton,
} from "./results";

export const metadata: Metadata = {
  title: "Disponibilidad",
  alternates: { canonical: "/disponibilidad" },
  robots: { index: false, follow: true },
};

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const validation = validateAvailabilityResultsQuery(params);
  if (!validation.ok) {
    if (isUnattemptedSearch(params)) {
      return (
        <AvailabilityResultsTemplate
          state="empty"
          bookingSearch={<AvailabilitySearchController presentation="hero" />}
        />
      );
    }
    return (
      <AvailabilityResultsTemplate
        state="invalid"
        errors={Object.fromEntries(
          Object.entries(validation.errors).map(([key, value]) => [
            key,
            value.message,
          ])
        )}
        bookingSearch={<AvailabilitySearchController presentation="hero" />}
      />
    );
  }
  const bookingSearch = (
    <AvailabilitySearchController
      key={`${validation.value.checkIn}:${validation.value.checkOut}:${validation.value.guests}:${validation.value.room ?? ""}`}
      initialCheckIn={validation.value.checkIn}
      initialCheckOut={validation.value.checkOut}
      initialGuests={validation.value.guests}
      room={validation.value.room}
      presentation="hero"
    />
  );
  if (process.env.NODE_ENV !== "production" && paramsForTestError(params)) {
    return (
      <AvailabilityResultsTemplate
        {...validation.value}
        state="error"
        bookingSearch={bookingSearch}
      />
    );
  }
  return (
    <AvailabilityResultsTemplate
      {...validation.value}
      bookingSearch={bookingSearch}
      results={
        <Suspense
          key={`${validation.value.checkIn}:${validation.value.checkOut}:${validation.value.guests}:${validation.value.room ?? ""}`}
          fallback={<AvailabilityResultsSkeleton />}
        >
          <AvailabilityResultsData query={validation.value} />
        </Suspense>
      }
    />
  );
}

function paramsForTestError(
  params: Record<string, string | string[] | undefined>
) {
  return params._testAvailabilityError === "1";
}

/** A first-time visit with no search criteria yet isn't an invalid query. */
function isUnattemptedSearch(
  params: Record<string, string | string[] | undefined>
) {
  return (
    params.checkIn === undefined &&
    params.checkOut === undefined &&
    params.guests === undefined &&
    params.room === undefined
  );
}
