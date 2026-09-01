"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/presentation/atoms";
import { Price } from "@/presentation/molecules";
import {
  effectiveRoomSelection,
  clearSessionRoomSelection,
  saveSessionRoomSelection,
  useSessionRoomSelection,
} from "./selection-session";

type Room = Readonly<{
  id: string;
  name: string;
  slug: string;
  nightlyPriceClp: number;
}>;

export function RoomSelectionSummary({
  rooms,
}: Readonly<{ rooms: readonly Room[] }>) {
  const searchParams = useSearchParams();
  const router = useRouter();
  // `useSearchParams` can be null while migrating from Pages Router. The URL is
  // still the single source of truth for this client-only cart in that case.
  const query =
    searchParams ??
    new URLSearchParams(
      typeof window === "undefined" ? "" : window.location.search
    );
  const storedSelection = useSessionRoomSelection();
  const selection = effectiveRoomSelection(query, storedSelection);
  const sessionSignature = `${selection?.checkIn ?? ""}:${selection?.checkOut ?? ""}:${selection?.rooms.join(",") ?? ""}`;
  const reducedMotion = useReducedMotion();
  const [expandedFor, setExpandedFor] = useState<string>();
  const panelId = "reservation-cart-items";
  const cartRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selection?.rooms.length) saveSessionRoomSelection(selection);
  }, [selection, sessionSignature]);
  useEffect(() => {
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent && event.key === "Escape")
        setExpandedFor(undefined);
      if (
        event instanceof MouseEvent &&
        !cartRef.current?.contains(event.target as Node)
      )
        setExpandedFor(undefined);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  const ids = new Set(selection?.rooms ?? []);
  const selected = rooms.filter(
    (room) => ids.has(room.slug) || ids.has(room.id)
  );
  const selectionKey = selected.map((room) => room.id).join(",");
  const expanded = expandedFor === selectionKey;
  const start = new Date(`${selection?.checkIn}T00:00:00Z`).getTime();
  const end = new Date(`${selection?.checkOut}T00:00:00Z`).getTime();
  const nights =
    Number.isFinite(start) && Number.isFinite(end)
      ? Math.max(0, Math.round((end - start) / 86_400_000))
      : 0;
  if (!selected.length) return null;
  const total = selected.reduce(
    (sum, room) => sum + room.nightlyPriceClp * nights,
    0
  );
  const itemLabel = selected.length === 1 ? "ítem agregado" : "ítems agregados";
  const removeRoom = (room: Room) => {
    if (!selection) return;
    const params = new URLSearchParams(window.location.search);
    params.set("checkIn", selection.checkIn);
    params.set("checkOut", selection.checkOut);
    const rooms = selection.rooms.filter(
      (id) => id !== room.slug && id !== room.id
    );
    if (rooms.length) {
      params.set("rooms", rooms.join(","));
      saveSessionRoomSelection({
        checkIn: selection.checkIn,
        checkOut: selection.checkOut,
        rooms,
      });
    } else {
      params.delete("rooms");
      clearSessionRoomSelection();
    }
    router.replace(`${window.location.pathname}?${params.toString()}`, {
      scroll: false,
    });
  };
  return (
    <motion.div
      ref={cartRef}
      aria-label="Carro de reserva"
      aria-live="polite"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-[56rem] rounded-[2rem] border border-border/80 bg-warm p-3 shadow-xl tablet:bottom-5 tablet:px-5"
      initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
      animate={
        reducedMotion
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 1, y: 0, scale: 1 }
      }
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
    >
      <div className="flex w-full flex-col gap-3 tablet:flex-row tablet:items-center">
        <div
          data-cart-zone="identity"
          className="flex shrink-0 items-center gap-3 tablet:pr-6"
        >
          <div className="relative flex size-11 items-center justify-center rounded-full bg-card text-foreground shadow-sm">
            <Icon decorative name="ShoppingCart" className="size-5" />
            <span className="absolute -right-1 -top-1 inline-flex size-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary">
              {selected.length}
            </span>
          </div>
          <h2 className="font-heading text-lg text-foreground">
            Carro de reservas
          </h2>
        </div>
        <div
          data-cart-zone="summary"
          className="min-w-0 flex-1 tablet:border-l tablet:border-border/80 tablet:px-6"
        >
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpandedFor(expanded ? undefined : selectionKey)}
            className="flex min-h-11 w-full items-center justify-between gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span>
              <span className="block text-sm font-semibold text-foreground">{`${selected.length} ${itemLabel}`}</span>
              <span className="block truncate text-sm text-muted-foreground">
                {nights} noches ·{" "}
                {selected.length === 1
                  ? "1 habitación"
                  : `${selected.length} habitaciones`}
              </span>
            </span>
            <span
              data-cart-expand-indicator
              data-state={expanded ? "expanded" : "collapsed"}
            >
              <Icon
                decorative
                name={expanded ? "ChevronUp" : "ChevronDown"}
                className="size-4 shrink-0"
              />
            </span>
          </button>
        </div>
        <div
          data-cart-zone="checkout"
          className="flex items-center justify-between gap-3 tablet:border-l tablet:border-border/80 tablet:pl-6"
        >
          <div className="shrink-0">
            <p className="text-xs font-medium text-muted-foreground">
              Subtotal
            </p>
            <Price amount={total} suffix="CLP" />
          </div>
          <a
            aria-label={`Ver carrito con ${selected.length} ${itemLabel}`}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary shadow-sm transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            href={`/pre-reserva?${new URLSearchParams({
              checkIn: selection?.checkIn ?? "",
              checkOut: selection?.checkOut ?? "",
              rooms: selected.map((room) => room.slug).join(","),
              guests: query.get("guests") ?? "1",
            }).toString()}`}
          >
            Ver carrito
            <Icon decorative name="ArrowRight" className="size-4" />
          </a>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id={panelId}
            className="mt-3 grid gap-1 border-t border-border pt-3"
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, y: 8 }}
            transition={{ duration: 0.3 }}
          >
            {selected.map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span>{room.name}</span>
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <span>{nights} noches ·</span>
                  <Price amount={room.nightlyPriceClp} />
                </div>
                <button
                  type="button"
                  onClick={() => removeRoom(room)}
                  aria-label={`Quitar ${room.name} de la reserva`}
                  className="inline-flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <Icon decorative name="X" className="size-4" />
                </button>
              </div>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
