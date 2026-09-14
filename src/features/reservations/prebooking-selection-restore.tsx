"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  effectiveRoomSelection,
  getSessionRoomSelection,
} from "./selection-session";
import { serializeRoomSelectionParam } from "./room-selection-codec";

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
    params.set("rooms", serializeRoomSelectionParam(selection.rooms));
    if (!params.get("guests")) params.set("guests", String(selection.guests));
    router.replace(`/pre-reserva?${params.toString()}`, { scroll: false });
  }, [query, router]);

  return null;
}
