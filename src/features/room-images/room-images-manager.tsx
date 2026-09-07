"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import { Button, Heading, Icon, Text } from "@/presentation/atoms";
import type { RoomImageActionResult } from "./actions";
import type { RoomImagePhoto } from "./room-images";

type ActionFn = (data: FormData) => Promise<RoomImageActionResult>;

export function RoomImagesManager({
  roomId,
  roomName,
  initialPhotos,
  upload,
  setPrimary,
  reorder,
  remove,
}: Readonly<{
  roomId: string;
  roomName: string;
  initialPhotos: readonly RoomImagePhoto[];
  upload: ActionFn;
  setPrimary: ActionFn;
  reorder: ActionFn;
  remove: ActionFn;
}>) {
  const [photos, setPhotos] = useState(initialPhotos);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [confirmRemoveId, setConfirmRemoveId] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const altTextRef = useRef<HTMLInputElement>(null);

  const run = async (action: ActionFn, build: (data: FormData) => void) => {
    setPending(true);
    setMessage(undefined);
    try {
      const data = new FormData();
      data.set("roomId", roomId);
      build(data);
      const result = await action(data);
      if (result.ok) setPhotos(result.photos);
      else setMessage(result.message);
    } catch {
      setMessage("No pudimos completar la operación.");
    } finally {
      setPending(false);
    }
  };

  const secondary = photos.filter((photo) => !photo.isPrimary);

  const moveSecondary = (photoId: string, direction: -1 | 1) => {
    const index = secondary.findIndex((photo) => photo.id === photoId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= secondary.length) return;
    const order = secondary.map((photo) => photo.id);
    [order[index], order[target]] = [order[target]!, order[index]!];
    void run(reorder, (data) => {
      for (const id of order) data.append("secondaryImageIds", id);
    });
  };

  return (
    <section className="space-y-4">
      <Heading level={2}>Fotos de {roomName}</Heading>
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
      <form
        aria-label="Subir fotos"
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const files = fileInputRef.current?.files;
          if (!files?.length) return;
          void run(upload, (data) => {
            for (const file of files) {
              data.append("files", file);
              data.append("altTexts", altTextRef.current?.value ?? "");
            }
          }).then(() => {
            if (fileInputRef.current) fileInputRef.current.value = "";
            if (altTextRef.current) altTextRef.current.value = "";
          });
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          Imágenes nuevas
          <input
            ref={fileInputRef}
            type="file"
            accept="image/avif,image/jpeg,image/png,image/webp"
            multiple
            className="min-h-11"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Descripción (opcional)
          <input
            ref={altTextRef}
            type="text"
            className="min-h-11 rounded-md border border-border bg-background px-3"
          />
        </label>
        <Button type="submit" loading={pending}>
          Subir fotos
        </Button>
      </form>

      {photos.length === 0 ? (
        <Text className="text-muted-foreground">
          Esta habitación no tiene fotos cargadas.
        </Text>
      ) : (
        <ul className="grid grid-cols-1 gap-4 tablet:grid-cols-2 laptop:grid-cols-3">
          {photos.map((photo) => (
            <li
              key={photo.id}
              className="space-y-2 rounded-lg border border-border bg-card p-3"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-md">
                <Image
                  src={photo.url}
                  alt={photo.altText || `Foto de ${roomName}`}
                  fill
                  sizes="(min-width: 64rem) 33vw, (min-width: 48rem) 50vw, 100vw"
                  className="object-cover"
                />
              </div>
              {photo.isPrimary ? (
                <p className="text-xs font-semibold text-accent">Principal</p>
              ) : (
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() =>
                    run(setPrimary, (data) => data.set("imageId", photo.id))
                  }
                >
                  Hacer principal
                </Button>
              )}
              {!photo.isPrimary && (
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="secondary"
                    disabled={pending}
                    aria-label={`Mover ${photo.altText || "foto"} hacia arriba`}
                    onClick={() => moveSecondary(photo.id, -1)}
                  >
                    <Icon decorative name="ChevronUp" />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    disabled={pending}
                    aria-label={`Mover ${photo.altText || "foto"} hacia abajo`}
                    onClick={() => moveSecondary(photo.id, 1)}
                  >
                    <Icon decorative name="ChevronDown" />
                  </Button>
                </div>
              )}
              {confirmRemoveId === photo.id ? (
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    disabled={pending}
                    onClick={() => {
                      setConfirmRemoveId(undefined);
                      void run(remove, (data) => data.set("imageId", photo.id));
                    }}
                  >
                    Confirmar eliminación
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setConfirmRemoveId(undefined)}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={() => setConfirmRemoveId(photo.id)}
                >
                  Eliminar
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
