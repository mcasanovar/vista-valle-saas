"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  serializeAvailabilityResultsQuery,
  validateAvailabilityResultsQuery,
  type AvailabilityResultsQueryField,
} from "./results-query";
import { publicAvailabilityDateMinimums } from "./date-only";
import { BookingSearch } from "@/presentation/organisms";
// This browser-only state module is intentionally separate from the
// reservations barrel, which also exposes server-only reservation commands.
// eslint-disable-next-line architecture/feature-public-api
import {
  getSessionRoomSelection,
  saveSessionRoomSelection,
} from "@/features/reservations/selection-session";

type AvailabilitySearchControllerProps = Readonly<{
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialGuests?: number;
  room?: string;
  presentation?: "compact" | "hero";
}>;

export function AvailabilitySearchController({
  initialCheckIn,
  initialCheckOut,
  initialGuests = 1,
  room: roomProp,
  presentation = "compact",
}: AvailabilitySearchControllerProps = {}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const savedSelection =
    typeof window === "undefined" ? null : getSessionRoomSelection();
  const [checkIn, setCheckIn] = useState(
    initialCheckIn ?? savedSelection?.checkIn ?? ""
  );
  const [checkOut, setCheckOut] = useState(
    initialCheckOut ?? savedSelection?.checkOut ?? ""
  );
  const [guests, setGuests] = useState(initialGuests);
  const [errors, setErrors] = useState<
    Partial<Record<AvailabilityResultsQueryField, string>>
  >({});
  const [announcement, setAnnouncement] = useState("");

  const room = useMemo(() => {
    if (roomProp !== undefined) return roomProp;
    if (typeof window === "undefined") return undefined;
    return new URLSearchParams(window.location.search).get("room") ?? undefined;
  }, [roomProp]);
  const dateMinimums = useMemo(() => publicAvailabilityDateMinimums(), []);
  const hasDateError = Boolean(errors.checkIn || errors.checkOut);

  function submit() {
    const validation = validateAvailabilityResultsQuery({
      checkIn,
      checkOut,
      guests: String(guests),
      ...(room ? { room } : {}),
    });

    if (!validation.ok) {
      const nextErrors = Object.fromEntries(
        Object.entries(validation.errors).map(([field, value]) => [
          field,
          value.message,
        ])
      ) as Partial<Record<AvailabilityResultsQueryField, string>>;
      setErrors(nextErrors);
      setAnnouncement("Revisa los campos marcados antes de continuar.");
      return;
    }

    setErrors({});
    setAnnouncement("Cargando disponibilidad.");
    const saved = getSessionRoomSelection();
    const rooms =
      saved?.checkIn === validation.value.checkIn &&
      saved.checkOut === validation.value.checkOut
        ? [...saved.rooms]
        : [];
    saveSessionRoomSelection({
      checkIn: validation.value.checkIn,
      checkOut: validation.value.checkOut,
      guests: validation.value.guests,
      rooms,
    });
    startTransition(() => {
      const href = new URL(
        serializeAvailabilityResultsQuery(validation.value),
        window.location.origin
      );
      if (rooms.length)
        href.searchParams.set(
          "rooms",
          rooms.map((room) => `${room.roomId}:${room.guestCount}`).join(",")
        );
      router.push(`${href.pathname}${href.search}`, { scroll: false });
    });
  }

  return (
    <div className="space-y-3">
      <BookingSearch
        formLabel="Consulta de disponibilidad"
        checkIn={checkIn}
        checkOut={checkOut}
        guests={guests}
        minGuests={1}
        maxGuests={20}
        checkInLabel="Fecha de entrada"
        checkOutLabel="Fecha de salida"
        checkInMin={dateMinimums.checkIn}
        checkOutMin={dateMinimums.checkOut}
        guestsLabel="Huéspedes"
        submitLabel="Consultar disponibilidad"
        checkInError={errors.checkIn}
        checkOutError={errors.checkOut}
        guestsError={errors.guests}
        room={room}
        roomError={errors.room}
        onCheckInChange={(value) => {
          setCheckIn(value);
          setErrors((current) => ({ ...current, checkIn: undefined }));
        }}
        onCheckOutChange={(value) => {
          setCheckOut(value);
          setErrors((current) => ({ ...current, checkOut: undefined }));
        }}
        onGuestsChange={(value) => {
          setGuests(value);
          setErrors((current) => ({ ...current, guests: undefined }));
        }}
        onSubmit={submit}
        pending={pending}
        presentation={presentation}
      />
      <p
        role="status"
        aria-live="polite"
        className={`text-sm text-foreground ${presentation === "hero" && hasDateError ? "laptop:pt-12" : ""}`}
      >
        {announcement}
      </p>
    </div>
  );
}
