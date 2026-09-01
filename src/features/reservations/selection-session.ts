"use client";

// `date-only` is a shared browser-safe domain module; the availability barrel
// also exposes server-only adapters and therefore cannot cross this boundary.
// eslint-disable-next-line architecture/feature-public-api
import { createLodgingInterval } from "@/features/availability/date-only";
import { useSyncExternalStore } from "react";

export type SessionRoomSelection = Readonly<{
  checkIn: string;
  checkOut: string;
  rooms: readonly string[];
}>;

const storageKey = "vista-valle.public-room-selection.v1";
const changedEvent = "vista-valle:room-selection-change";
let cachedRaw: string | null | undefined;
let cachedSelection: SessionRoomSelection | null = null;
const serverSelection: SessionRoomSelection | null = null;

function normalize(value: unknown): SessionRoomSelection | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.checkIn !== "string" ||
    typeof record.checkOut !== "string" ||
    !Array.isArray(record.rooms) ||
    record.rooms.some((room) => typeof room !== "string" || !room.trim())
  )
    return null;
  try {
    const interval = createLodgingInterval(record.checkIn, record.checkOut);
    return Object.freeze({
      checkIn: interval.checkIn,
      checkOut: interval.checkOut,
      rooms: Object.freeze([
        ...new Set(record.rooms.map((room) => room.trim())),
      ]),
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
    const urlRooms = (params.get("rooms") ?? "").split(",").filter(Boolean);
    const rooms =
      urlRooms.length > 0
        ? urlRooms
        : stored?.checkIn === interval.checkIn &&
            stored.checkOut === interval.checkOut
          ? [...stored.rooms]
          : [];
    return Object.freeze({
      checkIn: interval.checkIn,
      checkOut: interval.checkOut,
      rooms,
    });
  } catch {
    return null;
  }
}
