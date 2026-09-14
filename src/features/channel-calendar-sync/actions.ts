"use server";

import { revalidatePath } from "next/cache";
import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { getChannelConnectionStore } from "./store";
import type { ChannelPaymentBehavior, ChannelPlatform } from "./connections";

function readPlatform(data: FormData): ChannelPlatform {
  const value = String(data.get("platform") ?? "");
  if (value !== "airbnb" && value !== "booking")
    throw new Error("Plataforma inválida");
  return value;
}

function readPaymentBehavior(data: FormData): ChannelPaymentBehavior {
  const value = String(data.get("paymentBehavior") ?? "");
  if (value !== "auto_approved" && value !== "pay_at_property")
    throw new Error("Comportamiento de pago inválido");
  return value;
}

/** Saves (creates or replaces) a connection's inbound feed URL and activates it. */
export async function saveChannelConnectionAction(data: FormData) {
  await requireAdministrator();
  const connections = getChannelConnectionStore();
  if (!connections) throw new Error("Channel sync unavailable");
  const roomId = String(data.get("roomId") ?? "");
  const inboundFeedUrl = String(data.get("inboundFeedUrl") ?? "").trim();
  if (!roomId || !inboundFeedUrl)
    throw new Error("Indica la habitación y la URL del feed.");
  const platform = readPlatform(data);
  const paymentBehavior = readPaymentBehavior(data);
  const saved = await connections.setInboundFeedUrl({
    roomId,
    platform,
    inboundFeedUrl,
    paymentBehavior,
  });
  const enabled = await connections.setEnabled(saved.id, true);
  revalidatePath("/admin/sincronizaciones");
  return enabled;
}

/**
 * Booking-only: unlike Airbnb, Booking's own "Sync calendars" UI asks for
 * our outbound link before it hands out its inbound one, so an admin needs
 * a way to generate ours first, with no inbound URL yet. Deliberately not
 * generalized to every platform — Airbnb hands out its export link without
 * requiring ours first, so it never needs this and keeps using
 * `saveChannelConnectionAction` as the only way to create its connection.
 * The platform is hardcoded here, not read from the form, so this action
 * can never be used to create an Airbnb connection.
 */
export async function createBookingChannelConnectionAction(data: FormData) {
  await requireAdministrator();
  const connections = getChannelConnectionStore();
  if (!connections) throw new Error("Channel sync unavailable");
  const roomId = String(data.get("roomId") ?? "");
  if (!roomId) throw new Error("Indica la habitación.");
  const created = await connections.createPendingConnection(
    roomId,
    "booking",
    "pay_at_property"
  );
  revalidatePath("/admin/sincronizaciones");
  return created;
}

export async function setChannelConnectionEnabledAction(data: FormData) {
  await requireAdministrator();
  const connections = getChannelConnectionStore();
  if (!connections) throw new Error("Channel sync unavailable");
  const id = String(data.get("id") ?? "");
  const enabled = String(data.get("enabled") ?? "") === "true";
  const result = await connections.setEnabled(id, enabled);
  revalidatePath("/admin/sincronizaciones");
  return result;
}

export async function regenerateChannelConnectionTokenAction(data: FormData) {
  await requireAdministrator();
  const connections = getChannelConnectionStore();
  if (!connections) throw new Error("Channel sync unavailable");
  const id = String(data.get("id") ?? "");
  const result = await connections.regenerateOutboundToken(id);
  revalidatePath("/admin/sincronizaciones");
  return result;
}
