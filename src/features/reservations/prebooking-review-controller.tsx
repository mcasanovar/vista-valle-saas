"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ActionLink, Button, Heading, Icon } from "@/presentation/atoms";
import { Price } from "@/presentation/molecules";
import { BookingConfirmationController } from "./booking-confirmation-controller";
import { GuestInformationForm } from "./guest-information-form";
import type { PrebookingReview } from "./prebooking-review";
import {
  clearSessionRoomSelection,
  saveSessionRoomSelection,
} from "./selection-session";

export function PrebookingReviewController({
  review,
  bookingEnabled,
}: Readonly<{
  review: Extract<PrebookingReview, { kind: "ready" }>;
  bookingEnabled: boolean;
}>) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateQuery = (update: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    update(params);
    const rooms = (params.get("rooms") ?? "").split(",").filter(Boolean);
    if (rooms.length) {
      saveSessionRoomSelection({
        checkIn: params.get("checkIn") ?? review.checkIn,
        checkOut: params.get("checkOut") ?? review.checkOut,
        rooms,
      });
    } else {
      clearSessionRoomSelection();
    }
    router.replace(`/pre-reserva?${params.toString()}`, { scroll: false });
  };

  const removeRoom = (slug: string) => {
    updateQuery((params) => {
      const rooms = (params.get("rooms") ?? "")
        .split(",")
        .filter((room) => room && room !== slug);
      if (rooms.length) params.set("rooms", rooms.join(","));
      else params.delete("rooms");
    });
  };

  return (
    <main className="min-h-dvh bg-warm text-foreground">
      <div className="mx-auto max-w-content space-y-6 bg-transparent px-4 py-10 phone:px-6 tablet:px-8">
        <ActionLink href={`/disponibilidad?${searchParams?.toString() ?? ""}`}>
          ← Volver a disponibilidad
        </ActionLink>
        <header className="space-y-3">
          <div className="space-y-3">
            <Heading level={1}>Revisa tu reserva</Heading>
            <span aria-hidden="true" className="block h-1 w-14 bg-accent" />
          </div>
          <p className="text-muted-foreground">
            Confirma habitaciones y fechas antes de finalizar.
          </p>
        </header>
        <section
          aria-label="Fechas de la reserva"
          className="flex flex-wrap items-center gap-5 rounded-2xl bg-[#FBF5F0] p-5 shadow-md tablet:p-6"
        >
          <div>
            <p className="text-xs font-medium text-muted-foreground">Entrada</p>
            <p className="font-semibold">{formatDate(review.checkIn)}</p>
          </div>
          <div
            className="hidden h-8 w-px bg-border tablet:block"
            aria-hidden="true"
          />
          <div>
            <p className="text-xs font-medium text-muted-foreground">Salida</p>
            <p className="font-semibold">{formatDate(review.checkOut)}</p>
          </div>
        </section>
        <section aria-labelledby="prebooking-items-title" className="space-y-4">
          <div id="prebooking-items-title">
            <Heading level={2}>Habitaciones seleccionadas</Heading>
          </div>
          <p className="text-sm text-muted-foreground">
            {review.checkIn} al {review.checkOut} · {review.nights} noches
          </p>
          <ul className="space-y-3">
            {review.rooms.map((room) => (
              <li
                key={room.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-[#FBF5F0] p-5 shadow-md tablet:p-6"
              >
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden="true"
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-warm text-foreground"
                  >
                    <Icon decorative name="BedDouble" />
                  </span>
                  <div>
                    <h3 className="font-heading text-lg">{room.name}</h3>
                    <div className="text-sm text-muted-foreground">
                      <Price amount={room.nightlyPriceClp} /> por noche ·{" "}
                      {review.nights} noches
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Price amount={room.subtotalClp} />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => removeRoom(room.slug)}
                    aria-label={`Quitar ${room.name} de la reserva`}
                  >
                    Quitar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between rounded-2xl border border-[#F4E9DE] bg-[#F4E9DE] px-5 py-4 shadow-none tablet:px-6">
            <div>
              <p className="text-md font-medium text-muted-foreground">Total</p>
            </div>
            <Price amount={review.totalClp} />
          </div>
        </section>
        <GuestInformationForm />
        <BookingConfirmationController
          bookingEnabled={bookingEnabled}
          roomCount={review.rooms.length}
        />
      </div>
    </main>
  );
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
