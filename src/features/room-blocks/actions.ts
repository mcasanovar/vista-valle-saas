"use server";
import { revalidatePath } from "next/cache";
import { requireAdministrator } from "@/infrastructure/auth/authorization";
import {
  createRoomBlock,
  createRoomBlocks,
  confirmRoomBlocks,
  reviewRoomBlocks,
  removeRoomBlock,
  RoomBlockInputError,
  toSafeRoomBlockConflict,
} from "./manual-blocks";
function input(data: FormData) {
  return { roomIds: data.getAll("roomIds").map(String), checkIn: String(data.get("checkIn") ?? ""), checkOut: String(data.get("checkOut") ?? ""), reason: String(data.get("reason") ?? "") };
}
export async function reviewRoomBlocksAction(data: FormData) {
  await requireAdministrator();
  try { return await reviewRoomBlocks(input(data)); }
  catch (error) { return Object.freeze({ kind: "failure" as const, message: error instanceof RoomBlockInputError ? error.message : "No pudimos revisar los bloqueos." }); }
}
export async function confirmRoomBlocksAction(data: FormData): Promise<RoomBlockActionResult> {
  const user = await requireAdministrator();
  if (data.get("confirmConflicts") !== "true") return Object.freeze({ ok: false, code: "validation", roomIds: [], message: "Confirma los conflictos antes de crear los bloqueos." });
  try {
    const blocks = await confirmRoomBlocks(input(data), user.user.id);
    revalidatePath("/admin/bloqueos"); revalidatePath("/admin/calendario");
    return Object.freeze({ ok: true, blockIds: Object.freeze(blocks.map((block) => block.id)), roomIds: Object.freeze(blocks.map((block) => block.roomId)) });
  } catch (error) { return Object.freeze({ ok: false, code: error instanceof RoomBlockInputError ? "validation" : "failure", roomIds: [], message: error instanceof RoomBlockInputError ? error.message : "No pudimos crear los bloqueos." }); }
}
export type RoomBlockActionResult =
  | Readonly<{ ok: true; blockIds: readonly string[]; roomIds: readonly string[] }>
  | Readonly<{
      ok: false;
      code: "validation" | "conflict" | "failure";
      roomIds: readonly string[];
      message: string;
    }>;
export async function createRoomBlocksAction(
  data: FormData
): Promise<RoomBlockActionResult> {
  const user = await requireAdministrator();
  try {
    const blocks = await createRoomBlocks(
      {
        roomIds: data.getAll("roomIds").map(String),
        checkIn: String(data.get("checkIn") ?? ""),
        checkOut: String(data.get("checkOut") ?? ""),
        reason: String(data.get("reason") ?? ""),
      },
      user.user.id
    );
    revalidatePath("/admin/bloqueos");
    revalidatePath("/admin/calendario");
    return Object.freeze({
      ok: true,
      blockIds: Object.freeze(blocks.map((block) => block.id)),
      roomIds: Object.freeze(blocks.map((block) => block.roomId)),
    });
  } catch (error) {
    const conflict = toSafeRoomBlockConflict(error);
    if (conflict)
      return Object.freeze({
        ok: false,
        code: "conflict",
        roomIds: conflict.roomIds,
        message: "Una habitación seleccionada ya no está disponible.",
      });
    if (error instanceof RoomBlockInputError)
      return Object.freeze({
        ok: false,
        code: "validation",
        roomIds: [],
        message: error.message,
      });
    return Object.freeze({
      ok: false,
      code: "failure",
      roomIds: [],
      message: "No pudimos crear los bloqueos.",
    });
  }
}
export async function createRoomBlockAction(data: FormData) {
  const user = await requireAdministrator();
  const block = await createRoomBlock(
    {
      roomId: String(data.get("roomId") ?? ""),
      checkIn: String(data.get("checkIn") ?? ""),
      checkOut: String(data.get("checkOut") ?? ""),
      reason: String(data.get("reason") ?? ""),
    },
    user.user.id
  );
  revalidatePath("/admin/bloqueos");
  revalidatePath("/admin/calendario");
  return block;
}
export async function removeRoomBlockAction(data: FormData) {
  const user = await requireAdministrator();
  const block = await removeRoomBlock(
    String(data.get("id") ?? ""),
    user.user.id
  );
  revalidatePath("/admin/bloqueos");
  revalidatePath("/admin/calendario");
  return block;
}
