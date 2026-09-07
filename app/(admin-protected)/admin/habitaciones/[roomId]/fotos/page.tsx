import { notFound } from "next/navigation";
import { getRoomReadSource } from "@/features/rooms";
import { listRoomImages } from "@/features/room-images";
import { RoomImagesManager } from "@/features/room-images/room-images-manager";
import {
  removeRoomImageAction,
  reorderRoomImagesAction,
  setPrimaryRoomImageAction,
  uploadRoomImagesAction,
} from "@/features/room-images/actions";

export const dynamic = "force-dynamic";

export default async function RoomPhotosPage({
  params,
}: Readonly<{ params: Promise<{ roomId: string }> }>) {
  const { roomId } = await params;
  const source = await getRoomReadSource();
  const room = source.listActive().find((candidate) => candidate.id === roomId);
  if (!room) notFound();

  const photos = await listRoomImages(roomId);

  return (
    <RoomImagesManager
      roomId={roomId}
      roomName={room.name}
      initialPhotos={photos}
      upload={uploadRoomImagesAction}
      setPrimary={setPrimaryRoomImageAction}
      reorder={reorderRoomImagesAction}
      remove={removeRoomImageAction}
    />
  );
}
