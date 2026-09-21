import { ActionLink, Heading } from "@/presentation/atoms";
import {
  getRoomDraftSource,
  getRoomReadSource,
  resolveRoomPricingRecord,
  type RoomReadModel,
} from "@/features/rooms";
import { activateRoomAction } from "@/features/rooms/actions";
import { RoomDraftActivateButton } from "@/features/rooms/room-draft-activate-button";
import { listRoomImages } from "@/features/room-images";

export const dynamic = "force-dynamic";

function pricingStatusLabel(room: RoomReadModel) {
  if (room.capacity === 1) return "precio único";
  if (room.occupancyPrices.length === 0) return "tarifa por configurar";
  const { prices } = resolveRoomPricingRecord(room);
  const distinctPrices = new Set(prices).size;
  return distinctPrices === 1 ? "precio fijo" : `${distinctPrices} tarifas`;
}

export default async function RoomsPage() {
  const [source, drafts] = await Promise.all([
    getRoomReadSource(),
    getRoomDraftSource(),
  ]);
  const activeRooms = source.listActive();
  const rooms = await Promise.all(
    activeRooms.map(async (room) => ({
      ...room,
      managedPhotoCount: (await listRoomImages(room.id)).length,
    }))
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Heading level={1} className="font-heading text-title">
          Habitaciones
        </Heading>
        <ActionLink href="/admin/habitaciones/nueva" variant="action">
          Nueva habitación
        </ActionLink>
      </div>
      {drafts.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-dashed border-border p-4">
          <p className="font-semibold text-foreground">Borradores</p>
          <ul className="space-y-2">
            {drafts.map((draft) => (
              <li
                key={draft.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 p-3"
              >
                <div>
                  <p className="font-semibold">{draft.name || "Sin nombre"}</p>
                  <ActionLink href={`/admin/habitaciones/${draft.id}/fotos`}>
                    Gestionar fotos
                  </ActionLink>
                </div>
                <RoomDraftActivateButton
                  action={activateRoomAction}
                  roomId={draft.id}
                />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {rooms.length === 0 ? (
        <p className="text-muted-foreground">
          No hay habitaciones publicadas todavía.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 tablet:grid-cols-2 laptop:grid-cols-3">
          {rooms.map((room) => (
            <li
              key={room.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
            >
              <div>
                <p className="font-semibold">{room.name}</p>
                <p className="text-xs text-muted-foreground">
                  {room.managedPhotoCount}{" "}
                  {room.managedPhotoCount === 1 ? "foto" : "fotos"} ·{" "}
                  {pricingStatusLabel(room)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <ActionLink href={`/admin/habitaciones/${room.id}/fotos`}>
                  Gestionar fotos
                </ActionLink>
                <ActionLink href={`/admin/habitaciones/${room.id}/tarifas`}>
                  Editar tarifas
                </ActionLink>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
