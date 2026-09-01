"use client";

import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import type { RoomPhotoGalleryImage } from "./room-photo-gallery";

export default function RoomPhotoLightbox({
  close,
  index,
  onViewChange,
  slides,
}: Readonly<{
  close: () => void;
  index: number;
  onViewChange: (index: number) => void;
  slides: readonly RoomPhotoGalleryImage[];
}>) {
  return (
    <Lightbox
      open
      close={close}
      index={index}
      slides={slides}
      on={{ view: ({ index: nextIndex }) => onViewChange(nextIndex) }}
      controller={{ closeOnBackdropClick: true }}
      labels={{
        Close: "Cerrar",
        Next: "Siguiente foto",
        Previous: "Foto anterior",
        Lightbox: "Galería de fotos",
      }}
    />
  );
}
