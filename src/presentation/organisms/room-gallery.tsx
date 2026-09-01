"use client";

import Image from "next/image";
import { useEffect } from "react";
import { useRoomPhotoGallery } from "./room-photo-gallery";

export function RoomGallery({
  label = "Galería de habitación",
  roomSlug,
  images,
}: {
  label?: string;
  roomSlug: string;
  images: readonly { id: string; src: string; alt: string }[];
}) {
  if (
    !images.length ||
    images.some((image) => !image.src.trim() || !image.alt.trim())
  )
    throw new Error("Room gallery requires image source and alt");

  const { registerRoom, openPhoto } = useRoomPhotoGallery();

  useEffect(() => {
    registerRoom(roomSlug, images);
  }, [registerRoom, roomSlug, images]);

  return (
    <ul
      aria-label={label}
      className="grid gap-4 px-4 tablet:grid-cols-2 tablet:px-8 laptop:grid-cols-3"
    >
      {images.map((image, index) => (
        <li
          key={image.id}
          className="group relative aspect-[4/3] overflow-hidden rounded-xl shadow-sm"
        >
          <Image
            src={image.src}
            alt={image.alt}
            fill
            preload={index === 0}
            sizes="(min-width: 64rem) 33vw, (min-width: 48rem) 50vw, 100vw"
            className="object-cover transition-transform duration-200 ease-standard group-hover:scale-105"
          />
          <button
            type="button"
            onClick={() => openPhoto(roomSlug, index)}
            aria-label={`Ver foto ${index + 1} de ${images.length} de ${label} en pantalla completa`}
            className="absolute inset-0 cursor-zoom-in"
          />
        </li>
      ))}
    </ul>
  );
}
