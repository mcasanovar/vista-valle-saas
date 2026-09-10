"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState, type MouseEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ActionLink, Button, Heading, Icon, Text } from "@/presentation/atoms";
import { Price } from "@/presentation/molecules";
import { usePublicReducedMotion } from "./motion";
import { useOptionalRoomPhotoGallery } from "./room-photo-gallery";
// The card owns the public interaction; its state is still the reservations
// feature's URL/session representation rather than presentation state.
// eslint-disable-next-line architecture/feature-public-api, architecture/presentation-boundaries
import {
  effectiveRoomSelection,
  getSessionRoomSelection,
  saveSessionRoomSelection,
  useSessionRoomSelection,
} from "@/features/reservations/selection-session";
// eslint-disable-next-line architecture/feature-public-api, architecture/presentation-boundaries
import { isOccupancySelectable } from "@/features/reservations/guest-allocation";
// eslint-disable-next-line architecture/feature-public-api, architecture/presentation-boundaries
import { resolveDisplayRoomNightlyPrice } from "@/features/rooms/occupancy-pricing";
// eslint-disable-next-line architecture/feature-public-api, architecture/presentation-boundaries
import type { RoomOccupancyPrice } from "@/features/rooms/read-model";

const selectableOccupancies = [1, 2] as const;

export function RoomCard({
  image,
  images,
  roomSlug,
  name,
  capacity,
  capacityCount = 1,
  occupancyPrices = [],
  beds,
  bathroom,
  amenities,
  price,
  priceSuffix,
  detailHref,
  detailLabel = "Ver detalle",
  headingLevel = 3,
  numberLabel,
  selectable = false,
  featured = false,
}: {
  image?: { src: string; alt: string };
  images?: readonly { src: string; alt: string }[];
  roomSlug?: string;
  name: string;
  capacity: string;
  /** Raw guest capacity, used to decide whether the occupancy selector applies. Defaults to 1 (no selector) for callers that don't track it. */
  capacityCount?: number;
  occupancyPrices?: readonly RoomOccupancyPrice[];
  beds: string;
  bathroom?: string;
  amenities?: readonly string[];
  price: number;
  priceSuffix?: string;
  detailHref: string;
  detailLabel?: string;
  headingLevel?: 2 | 3;
  numberLabel?: string;
  selectable?: boolean;
  featured?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storedSelection = useSessionRoomSelection();
  const currentParams = new URLSearchParams(searchParams?.toString() ?? "");
  const selection = effectiveRoomSelection(currentParams, storedSelection);
  const existingEntry = roomSlug
    ? selection?.rooms.find((room) => room.roomId === roomSlug)
    : undefined;
  const selected = Boolean(existingEntry);
  const hasOccupancyChoice = capacityCount > 1;
  const [pendingOccupancy, setPendingOccupancy] = useState<number | null>(
    hasOccupancyChoice ? null : 1
  );
  const occupancy = selected ? (existingEntry?.guestCount ?? 1) : pendingOccupancy;
  const [added, setAdded] = useState(false);
  const [travel, setTravel] = useState<{
    left: number;
    top: number;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const shouldReduceMotion = usePublicReducedMotion();
  const animated = !shouldReduceMotion;
  const gallery = useOptionalRoomPhotoGallery();
  if (image && (!image.src.trim() || !image.alt.trim()))
    throw new Error("Room image source and alt are required");

  useEffect(() => {
    if (gallery && images?.length && roomSlug) {
      gallery.registerRoom(roomSlug, images);
    }
  }, [gallery, images, roomSlug]);

  const chooseOccupancy = (nextOccupancy: number) => {
    if (!roomSlug) return;
    if (selected && selection) {
      const rooms = selection.rooms.map((room) =>
        room.roomId === roomSlug
          ? { ...room, guestCount: nextOccupancy }
          : room
      );
      saveSessionRoomSelection({ ...selection, rooms });
    } else {
      setPendingOccupancy(nextOccupancy);
    }
  };

  const toggleSelection = (source: HTMLButtonElement) => {
    if (!roomSlug) return;
    const params = new URLSearchParams(window.location.search);
    const effective = effectiveRoomSelection(params, getSessionRoomSelection());
    if (!effective) return;
    params.set("checkIn", effective.checkIn);
    params.set("checkOut", effective.checkOut);
    const rooms = selected
      ? effective.rooms.filter((room) => room.roomId !== roomSlug)
      : [
          ...effective.rooms,
          { guestCount: pendingOccupancy ?? 1, roomId: roomSlug },
        ];
    if (rooms.length) {
      params.set(
        "rooms",
        [...rooms]
          .sort((left, right) => left.roomId.localeCompare(right.roomId))
          .map((room) => `${room.roomId}:${room.guestCount}`)
          .join(",")
      );
    } else {
      params.delete("rooms");
    }
    saveSessionRoomSelection({
      checkIn: effective.checkIn,
      checkOut: effective.checkOut,
      guests: effective.guests,
      rooms: [...rooms].sort((left, right) =>
        left.roomId.localeCompare(right.roomId)
      ),
    });
    router.push(`${window.location.pathname}?${params.toString()}`, {
      scroll: false,
    });
    if (!selected) {
      setAdded(true);
      if (!shouldReduceMotion) {
        const bounds = source.getBoundingClientRect();
        const cart = document.querySelector('[aria-label="Carro de reserva"]');
        const cartBounds = cart?.getBoundingClientRect();
        const targetX = cartBounds
          ? cartBounds.left + cartBounds.width / 2
          : window.innerWidth / 2;
        const targetY = cartBounds
          ? cartBounds.top + cartBounds.height / 2
          : window.innerHeight - 48;
        setTravel({
          left: bounds.left + bounds.width / 2,
          top: bounds.top + bounds.height / 2,
          x: targetX - bounds.left - bounds.width / 2,
          y: targetY - bounds.top - bounds.height / 2,
          width: bounds.width,
          height: bounds.height,
        });
      }
      window.setTimeout(() => setAdded(false), 420);
    }
  };
  const selectedDetailHref = (() => {
    if (!roomSlug || !selection?.rooms.length) return detailHref;
    const url = new URL(detailHref, "http://vistavalle.local");
    url.searchParams.set(
      "rooms",
      [...selection.rooms]
        .sort((left, right) => left.roomId.localeCompare(right.roomId))
        .map((room) => `${room.roomId}:${room.guestCount}`)
        .join(",")
    );
    return `${url.pathname}${url.search}`;
  })();
  const displayedPrice =
    occupancy !== null
      ? resolveDisplayRoomNightlyPrice(
          { capacity: capacityCount || 1, nightlyPriceClp: price },
          occupancyPrices,
          occupancy
        )
      : Math.min(
          price,
          ...occupancyPrices.map((entry) => entry.priceClp)
        );
  const canAddNow = !hasOccupancyChoice || occupancy !== null;

  return (
    <motion.article
      data-motion={animated ? "enabled" : "reduced"}
      whileHover={animated ? { y: -4 } : undefined}
      whileTap={animated ? { scale: 0.99 } : undefined}
      transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
      className={`vv-room-card flex flex-col overflow-hidden rounded-none border border-border bg-card shadow-none ${featured ? "vv-room-card-featured" : ""}`}
    >
      {travel ? (
        <motion.span
          key={`${travel.left}-${travel.top}`}
          data-cart-animation
          aria-hidden="true"
          className="pointer-events-none fixed z-50 rounded-full bg-primary"
          style={{
            left: travel.left,
            top: travel.top,
            width: travel.width,
            height: travel.height,
          }}
          initial={{ opacity: 0.9, x: 0, y: 0, scale: 1 }}
          animate={{ opacity: 0, x: travel.x, y: travel.y, scale: 0.25 }}
          transition={{ duration: 0.68, ease: [0.2, 0, 0, 1] }}
          onAnimationComplete={() => setTravel(null)}
        />
      ) : null}
      {image ? (
        <div className="relative aspect-[4/3]">
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(min-width: 48rem) 50vw, 100vw"
            className="object-cover"
          />
          {gallery && images?.length && roomSlug ? (
            <button
              type="button"
              onClick={() => gallery.openPhoto(roomSlug, 0)}
              aria-label={`Ver fotos de ${name}`}
              className="group/photo absolute inset-0 cursor-zoom-in"
            >
              <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-foreground/70 px-2.5 py-1 text-xs text-background opacity-0 backdrop-blur-sm transition-opacity duration-200 ease-standard group-hover/photo:opacity-100 group-focus-visible/photo:opacity-100">
                <Icon decorative name="Expand" className="size-3.5" />
                {images.length} {images.length === 1 ? "foto" : "fotos"}
              </span>
            </button>
          ) : null}
        </div>
      ) : (
        <div className="vv-image-frame flex aspect-[4/3] items-center justify-center p-5 text-center">
          <Text className="max-w-xs text-sm text-muted-foreground">
            Imagen de habitación pendiente de aprobación.
          </Text>
        </div>
      )}
      <div className="flex flex-col flex-grow p-5 gap-4">
        {numberLabel ? (
          <p
            aria-hidden="true"
            className="font-heading text-xs tracking-[0.06em] text-accent"
          >
            {numberLabel}
          </p>
        ) : null}
        <Heading level={headingLevel}>{name}</Heading>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1 py-2">
            <Icon decorative name="Users" />
            {capacity}
          </span>
          <span aria-hidden="true" className="h-4 w-px bg-border" />
          <span className="inline-flex items-center gap-1">
            <Icon decorative name="Bed" />
            {beds}
          </span>
        </div>
        {bathroom ? (
          <p className="text-sm text-muted-foreground">Baño: {bathroom}</p>
        ) : null}
        {amenities?.length ? (
          <ul aria-label="Servicios incluidos" className="flex flex-wrap gap-2">
            {amenities.map((amenity) => (
              <li
                key={amenity}
                className="rounded-full bg-muted px-2 py-1 text-xs"
              >
                {amenity}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex-grow" />
        {hasOccupancyChoice ? (
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">
              Personas en esta habitación
            </span>
            <div
              role="group"
              aria-label="Cantidad de personas"
              className="inline-flex rounded-full border border-border bg-muted p-1"
            >
              {selectableOccupancies
                .filter((value) => value <= capacityCount)
                .map((value) => {
                  const disabled =
                    roomSlug !== undefined &&
                    selection !== null &&
                    !isOccupancySelectable(
                      selection.guests,
                      selection.rooms,
                      roomSlug,
                      value
                    );
                  return (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={occupancy === value}
                      disabled={disabled}
                      onClick={() => chooseOccupancy(value)}
                      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 text-sm font-semibold transition-colors ${
                        occupancy === value
                          ? "bg-foreground text-background"
                          : "text-muted-foreground"
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      {value} {value === 1 ? "persona" : "personas"}
                    </button>
                  );
                })}
            </div>
          </div>
        ) : null}
        <Price
          amount={displayedPrice}
          label={occupancy === null ? "Desde" : ""}
          suffix={priceSuffix}
        />
        <ActionLink
          href={selectedDetailHref}
          variant="action"
          className="w-full justify-center bg-warm text-primary font-bold no-underline hover:bg-warm active:bg-warm"
        >
          {detailLabel}
        </ActionLink>
        {selectable ? (
          selected ? (
            <div className="space-y-2">
              <p role="status" className="text-sm text-success">
                Ya se encuentra agregada
              </p>
              <Button
                type="button"
                variant="secondary"
                onClick={(event: MouseEvent<HTMLButtonElement>) =>
                  toggleSelection(event.currentTarget)
                }
              >
                Quitar de la reserva
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              disabled={!canAddNow}
              onClick={(event: MouseEvent<HTMLButtonElement>) =>
                toggleSelection(event.currentTarget)
              }
            >
              Agregar a la reserva
            </Button>
          )
        ) : null}
        {selectable && added && !selected ? (
          <p role="status" className="text-sm text-success">
            Agregada a tu reserva
          </p>
        ) : null}
      </div>
    </motion.article>
  );
}
