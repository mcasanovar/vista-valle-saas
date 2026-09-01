"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  effectiveRoomSelection,
  getSessionRoomSelection,
} from "./selection-session";

/** Restores only the non-personal, session-scoped selection before server revalidation. */
export function PrebookingSelectionRestore() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams?.toString() ?? "";

  useEffect(() => {
    const params = new URLSearchParams(query);
    if (params.get("rooms")) return;
    const selection = effectiveRoomSelection(params, getSessionRoomSelection());
    if (!selection?.rooms.length) return;

    params.set("checkIn", selection.checkIn);
    params.set("checkOut", selection.checkOut);
    params.set("rooms", selection.rooms.join(","));
    // Guests are not part of the persisted selection and the authoritative
    // command does not use them for multi-room public bookings.
    if (!params.get("guests")) params.set("guests", "1");
    router.replace(`/pre-reserva?${params.toString()}`, { scroll: false });
  }, [query, router]);

  return null;
}
