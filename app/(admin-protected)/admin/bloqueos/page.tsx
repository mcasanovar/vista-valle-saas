import {
  createRoomBlocksAction,
  confirmRoomBlocksAction,
  removeRoomBlockAction,
  reviewRoomBlocksAction,
} from "@/features/room-blocks/actions";
import { getRoomReadSource } from "@/features/rooms";
import { ManualBlockForm } from "@/features/room-blocks/manual-block-form";
import { listRoomBlocks } from "@/features/room-blocks/manual-blocks";
import { createLodgingInterval } from "@/features/availability/date-only";

export const dynamic = "force-dynamic";

export default async function BlocksPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const query = await searchParams;
  const one = (key: string) =>
    typeof query[key] === "string" ? query[key] : undefined;
  const datePair = (checkIn?: string, checkOut?: string): Readonly<{ checkIn?: string; checkOut?: string }> => {
    try {
      return checkIn && checkOut
        ? createLodgingInterval(checkIn, checkOut)
        : {};
    } catch {
      return {};
    }
  };
  const state = one("status");
  const dates = datePair(one("checkIn"), one("checkOut"));
  const quickDates = datePair(one("quickCheckIn"), one("quickCheckOut"));
  const filter = {
    roomId: one("roomId"),
    checkIn: dates.checkIn,
    checkOut: dates.checkOut,
    reason: one("reason"),
    status: state === "all" || state === "removed" ? state : "active",
    page: Math.max(1, Number(one("page")) || 1),
  } as const;
  const [blocks, source] = await Promise.all([
    listRoomBlocks(filter),
    getRoomReadSource(),
  ]);
  return (
    <section className="space-y-4">
      <h1 className="font-heading text-title">Bloqueos de habitación</h1>
      <ManualBlockForm
        blocks={blocks.items}
        rooms={source.listActive().map(({ id, name }) => ({ id, name }))}
        create={createRoomBlocksAction}
        confirm={confirmRoomBlocksAction}
        review={reviewRoomBlocksAction}
        remove={removeRoomBlockAction}
        initialSelection={{
          roomId: one("quickRoomId") ?? filter.roomId,
          checkIn: quickDates.checkIn ?? filter.checkIn,
          checkOut: quickDates.checkOut ?? filter.checkOut,
        }}
        filters={filter}
        page={blocks.page}
        pageSize={blocks.pageSize}
        total={blocks.total}
      />
    </section>
  );
}
