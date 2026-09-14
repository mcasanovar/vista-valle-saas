"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useState, type MouseEvent } from "react";
import { Button } from "@/presentation/atoms";
import {
  effectiveRoomSelection,
  saveSessionRoomSelection,
  useSessionRoomSelection,
} from "./selection-session";
export function RoomDetailSelectionButton({
  slug,
  guestCount = 1,
  disabled = false,
}: Readonly<{ slug: string; guestCount?: number; disabled?: boolean }>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storedSelection = useSessionRoomSelection();
  const selection = effectiveRoomSelection(
    new URLSearchParams(searchParams?.toString() ?? ""),
    storedSelection
  );
  const [added, setAdded] = useState(false);
  const [travel, setTravel] = useState<{
    left: number;
    top: number;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const updateSelection = (source?: HTMLButtonElement) => {
    if (!selection) return;
    const params = new URLSearchParams(window.location.search);
    params.set("checkIn", selection.checkIn);
    params.set("checkOut", selection.checkOut);
    const isSelected = selection.rooms.some((room) => room.roomId === slug);
    const rooms = isSelected
      ? selection.rooms.filter((room) => room.roomId !== slug)
      : [...selection.rooms, { guestCount, roomId: slug }];
    if (rooms.length)
      params.set(
        "rooms",
        rooms.map((room) => `${room.roomId}:${room.guestCount}`).join(",")
      );
    else params.delete("rooms");
    saveSessionRoomSelection({
      checkIn: selection.checkIn,
      checkOut: selection.checkOut,
      guests: selection.guests,
      rooms,
    });
    router.replace(`${window.location.pathname}?${params}`, { scroll: false });
    setAdded(!isSelected);
    if (
      !isSelected &&
      source &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
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
  };
  const isSelected = Boolean(
    selection?.rooms.some((room) => room.roomId === slug)
  );
  return (
    <div>
      {selection ? (
        <>
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
          {isSelected ? (
            <div className="space-y-2">
              <p role="status" className="text-sm text-success">
                Ya se encuentra agregada
              </p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => updateSelection()}
              >
                Quitar de la reserva
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              disabled={disabled}
              onClick={(event: MouseEvent<HTMLButtonElement>) =>
                updateSelection(event.currentTarget)
              }
            >
              Agregar a la reserva
            </Button>
          )}
          {added && !isSelected ? (
            <span role="status" className="ml-2 text-sm text-success">
              Agregada a tu reserva
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
