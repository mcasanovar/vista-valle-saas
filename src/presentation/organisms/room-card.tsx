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

export function RoomCard({
  image,
  images,
  roomSlug,
  name,
  capacity,
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
}: {
  image?: { src: string; alt: string };
  images?: readonly { src: string; alt: string }[];
  roomSlug?: string;
  name: string;
  capacity: string;
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
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storedSelection = useSessionRoomSelection();
  const currentParams = new URLSearchParams(searchParams?.toString() ?? "");
  const selection = effectiveRoomSelection(currentParams, storedSelection);
  const selectedRooms = new Set(selection?.rooms ?? []);
  const selected = Boolean(roomSlug && selectedRooms.has(roomSlug));
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
  const toggleSelection = (source: HTMLButtonElement) => {
    if (!roomSlug) return;
    const params = new URLSearchParams(window.location.search);
    const effective = effectiveRoomSelection(params, getSessionRoomSelection());
    if (!effective) return;
    params.set("checkIn", effective.checkIn);
    params.set("checkOut", effective.checkOut);
    const rooms = new Set(effective.rooms);
    if (selected) rooms.delete(roomSlug);
    else rooms.add(roomSlug);
    if (rooms.size) params.set("rooms", [...rooms].sort().join(","));
    else params.delete("rooms");
    saveSessionRoomSelection({
      checkIn: effective.checkIn,
      checkOut: effective.checkOut,
      rooms: [...rooms].sort(),
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
    if (!roomSlug || selectedRooms.size === 0) return detailHref;
    const url = new URL(detailHref, "http://vistavalle.local");
    url.searchParams.set("rooms", [...selectedRooms].sort().join(","));
    return `${url.pathname}${url.search}`;
  })();

  return (
    <motion.article
      data-motion={animated ? "enabled" : "reduced"}
      whileHover={animated ? { y: -4 } : undefined}
      whileTap={animated ? { scale: 0.99 } : undefined}
      transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
      className="flex flex-col overflow-hidden rounded-lg bg-card shadow-md"
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
        <Price amount={price} suffix={priceSuffix} />
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
