import { notFound } from "next/navigation";
import { ActionLink, Heading } from "@/presentation/atoms";
import { getRoomReadSource } from "@/features/rooms";
import { RoomPricingSettings } from "@/features/admin/room-pricing-settings";

export const dynamic = "force-dynamic";

export default async function RoomPricingPage({
  params,
}: Readonly<{ params: Promise<{ roomId: string }> }>) {
  const { roomId } = await params;
  const source = await getRoomReadSource();
  const room = source.listActive().find((candidate) => candidate.id === roomId);
  if (!room) notFound();

  return (
    <section className="space-y-4">
      <ActionLink href="/admin/habitaciones">← Volver a habitaciones</ActionLink>
      <Heading level={1} className="font-heading text-title">
        Tarifas de {room.name}
      </Heading>
      <RoomPricingSettings roomId={roomId} />
    </section>
  );
}
