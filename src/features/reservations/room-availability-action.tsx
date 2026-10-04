"use client";

import { Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { ActionLink } from "@/presentation/atoms";
// Deep import (not the `@/features/availability` barrel) so this client
// component never pulls in `search-source.ts`'s `import "server-only"` guard.
// eslint-disable-next-line architecture/feature-public-api
import {
  serializeAvailabilityResultsQuery,
  validateAvailabilityResultsQuery,
} from "@/features/availability/results-query";

type RoomAvailabilityActionProps = Readonly<{
  roomSlug: string;
  fallbackHref: string;
  className?: string;
  children: ReactNode;
}>;

function resolveHref(
  roomSlug: string,
  searchParams: URLSearchParams,
  fallbackHref: string
) {
  const validation = validateAvailabilityResultsQuery(
    Object.fromEntries(searchParams.entries())
  );
  return validation.ok
    ? serializeAvailabilityResultsQuery({ ...validation.value, room: roomSlug })
    : fallbackHref;
}

/**
 * Reads the active availability search from the URL inside its own
 * `<Suspense>` boundary, so the surrounding static link (rendered by the
 * fallback below) is never swallowed by an empty fallback. The link itself
 * is never part of a room's indexable content.
 */
function RoomAvailabilityActionReader({
  roomSlug,
  fallbackHref,
  className,
  children,
}: RoomAvailabilityActionProps) {
  const searchParams = useSearchParams();
  const href = resolveHref(
    roomSlug,
    new URLSearchParams(searchParams?.toString() ?? ""),
    fallbackHref
  );
  return (
    <ActionLink href={href} variant="action" className={className}>
      {children}
    </ActionLink>
  );
}

export function RoomAvailabilityAction({
  roomSlug,
  fallbackHref,
  className,
  children,
}: RoomAvailabilityActionProps) {
  return (
    <Suspense
      fallback={
        <ActionLink href={fallbackHref} variant="action" className={className}>
          {children}
        </ActionLink>
      }
    >
      <RoomAvailabilityActionReader
        roomSlug={roomSlug}
        fallbackHref={fallbackHref}
        className={className}
      >
        {children}
      </RoomAvailabilityActionReader>
    </Suspense>
  );
}
