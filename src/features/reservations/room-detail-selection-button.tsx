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
}: Readonly<{ slug: string }>) {
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
    const rooms = new Set(selection.rooms);
    const isSelected = rooms.has(slug);
    if (isSelected) rooms.delete(slug);
    else rooms.add(slug);
    if (rooms.size) params.set("rooms", [...rooms].sort().join(","));
    else params.delete("rooms");
    saveSessionRoomSelection({
      checkIn: selection.checkIn,
      checkOut: selection.checkOut,
      rooms: [...rooms].sort(),
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
  const isSelected = Boolean(selection?.rooms.includes(slug));
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
