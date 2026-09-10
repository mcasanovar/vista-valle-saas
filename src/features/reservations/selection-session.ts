"use client";

// `date-only` is a shared browser-safe domain module; the availability barrel
// also exposes server-only adapters and therefore cannot cross this boundary.
// eslint-disable-next-line architecture/feature-public-api
import { createLodgingInterval } from "@/features/availability/date-only";
import { useSyncExternalStore } from "react";
import {
  parseRoomSelectionParam,
  type RoomOccupancySelection,
} from "./room-selection-codec";

export type SessionRoomSelection = Readonly<{
  checkIn: string;
  checkOut: string;
  /** Total guests the visitor searched for - the target the cart's rooms should add up to. */
  guests: number;
  rooms: readonly RoomOccupancySelection[];
}>;

const storageKey = "vista-valle.public-room-selection.v2";
const changedEvent = "vista-valle:room-selection-change";
let cachedRaw: string | null | undefined;
let cachedSelection: SessionRoomSelection | null = null;
const serverSelection: SessionRoomSelection | null = null;

function normalizeRooms(value: unknown): readonly RoomOccupancySelection[] | null {
  if (!Array.isArray(value)) return null;
  const byRoomId = new Map<string, number>();
  for (const entry of value) {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof (entry as { roomId?: unknown }).roomId !== "string" ||
      !(entry as { roomId: string }).roomId.trim() ||
      !Number.isSafeInteger((entry as { guestCount?: unknown }).guestCount) ||
      ((entry as { guestCount: number }).guestCount as number) <= 0
    ) {
      return null;
    }
    const record = entry as { roomId: string; guestCount: number };
    byRoomId.set(record.roomId.trim(), record.guestCount);
  }
  return Object.freeze(
    [...byRoomId.entries()].map(([roomId, guestCount]) =>
      Object.freeze({ roomId, guestCount })
    )
  );
}

function normalize(value: unknown): SessionRoomSelection | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.checkIn !== "string" ||
    typeof record.checkOut !== "string" ||
    !Number.isSafeInteger(record.guests) ||
    (record.guests as number) <= 0
  )
    return null;
  const rooms = normalizeRooms(record.rooms);
  if (!rooms) return null;
  try {
    const interval = createLodgingInterval(record.checkIn, record.checkOut);
    return Object.freeze({
      checkIn: interval.checkIn,
      checkOut: interval.checkOut,
      guests: record.guests as number,
      rooms,
    });
  } catch {
    return null;
  }
}

export function getSessionRoomSelection(): SessionRoomSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (raw === cachedRaw) return cachedSelection;
    cachedRaw = raw;
    cachedSelection = normalize(JSON.parse(raw ?? "null"));
    return cachedSelection;
  } catch {
    cachedRaw = undefined;
    cachedSelection = null;
    return null;
  }
}

export function saveSessionRoomSelection(value: SessionRoomSelection) {
  const normalized = normalize(value);
  if (typeof window === "undefined" || !normalized) return;
  window.sessionStorage.setItem(storageKey, JSON.stringify(normalized));
  window.dispatchEvent(new Event(changedEvent));
}

export function clearSessionRoomSelection() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(storageKey);
    window.dispatchEvent(new Event(changedEvent));
  }
}

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(changedEvent, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(changedEvent, listener);
  };
}

export function useSessionRoomSelection() {
  return useSyncExternalStore(
    subscribe,
    getSessionRoomSelection,
    () => serverSelection
  );
}

export function effectiveRoomSelection(
  params: URLSearchParams,
  stored: SessionRoomSelection | null = getSessionRoomSelection()
) {
  const checkIn = params.get("checkIn") ?? stored?.checkIn;
  const checkOut = params.get("checkOut") ?? stored?.checkOut;
  if (!checkIn || !checkOut) return null;
  try {
    const interval = createLodgingInterval(checkIn, checkOut);
    const sameStay =
      stored?.checkIn === interval.checkIn &&
      stored?.checkOut === interval.checkOut;
    const guestsParam = Number(params.get("guests"));
    const guests =
      Number.isSafeInteger(guestsParam) && guestsParam > 0
        ? guestsParam
        : sameStay
          ? stored!.guests
          : 1;
    const urlRooms = parseRoomSelectionParam(params.get("rooms"));
    const rooms = urlRooms.length > 0 ? urlRooms : sameStay ? stored!.rooms : [];
    return Object.freeze({
      checkIn: interval.checkIn,
      checkOut: interval.checkOut,
      guests,
      rooms,
    });
  } catch {
    return null;
  }
}
