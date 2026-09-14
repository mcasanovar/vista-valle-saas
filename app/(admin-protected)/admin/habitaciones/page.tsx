import { ActionLink, Heading } from "@/presentation/atoms";
import {
  getRoomReadSource,
  resolveRoomPricingRecord,
  type RoomReadModel,
} from "@/features/rooms";
import { listRoomImages } from "@/features/room-images";

export const dynamic = "force-dynamic";

function pricingStatusLabel(room: RoomReadModel) {
  if (room.capacity === 1) return "precio único";
  if (room.occupancyPrices.length === 0) return "tarifa por configurar";
  const { priceOneGuestClp, priceTwoGuestsClp } = resolveRoomPricingRecord(room);
  return priceOneGuestClp === priceTwoGuestsClp
    ? "precio fijo"
    : "dos tarifas";
}

export default async function RoomsPage() {
  const source = await getRoomReadSource();
  const activeRooms = source.listActive();
  const rooms = await Promise.all(
    activeRooms.map(async (room) => ({
      ...room,
      managedPhotoCount: (await listRoomImages(room.id)).length,
    }))
  );

  return (
    <section className="space-y-4">
      <Heading level={1} className="font-heading text-title">
        Habitaciones
      </Heading>
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
