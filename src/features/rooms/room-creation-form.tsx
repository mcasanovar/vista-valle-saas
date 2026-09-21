"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, Feedback } from "@/presentation/atoms";
import { FormField } from "@/presentation/molecules";
import type {
  AmenityActionResult,
  RoomCreationActionResult,
} from "./actions";
import type { AmenityRecord } from "./room-creation-admin";
import { slugify } from "./room-creation-admin";

export function RoomCreationForm({
  action,
  createAmenity,
  initialAmenities,
}: Readonly<{
  action: (data: FormData) => Promise<RoomCreationActionResult>;
  createAmenity: (data: FormData) => Promise<AmenityActionResult>;
  initialAmenities: readonly AmenityRecord[];
}>) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState("");
  const [amenities, setAmenities] = useState(initialAmenities);
  const [selectedAmenityIds, setSelectedAmenityIds] = useState<
    readonly string[]
  >([]);
  const [newAmenityName, setNewAmenityName] = useState("");
  const [addingAmenity, setAddingAmenity] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const updateName = (value: string) => {
    setName(value);
    if (!slugTouched) {
      try {
        setSlug(value.trim() ? slugify(value) : "");
      } catch {
        setSlug("");
      }
    }
  };

  const toggleAmenity = (amenityId: string, checked: boolean) => {
    setSelectedAmenityIds((current) =>
      checked
        ? [...current, amenityId]
        : current.filter((id) => id !== amenityId)
    );
  };

  const addAmenity = async () => {
    if (!newAmenityName.trim() || addingAmenity) return;
    setAddingAmenity(true);
    setError(undefined);
    try {
      const data = new FormData();
      data.set("name", newAmenityName.trim());
      const result = await createAmenity(data);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setAmenities(result.amenities);
      const created = result.amenities.find(
        (amenity) => amenity.name === newAmenityName.trim()
      );
      if (created) {
        setSelectedAmenityIds((current) =>
          current.includes(created.id) ? current : [...current, created.id]
        );
      }
      setNewAmenityName("");
    } catch {
      setError("No pudimos crear la amenidad.");
    } finally {
      setAddingAmenity(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(undefined);
    try {
      const data = new FormData(event.currentTarget);
      data.set("slug", slug);
      for (const amenityId of selectedAmenityIds) {
        data.append("amenityIds", amenityId);
      }
      const result = await action(data);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/admin/habitaciones/${result.roomId}/fotos`);
    } catch {
      setError("No pudimos crear la habitación.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Crear habitación"
      className="max-w-2xl space-y-5 rounded-xl border border-border bg-card p-4 tablet:p-5"
    >
      <FormField
        id="room-name"
        label="Nombre"
        required
        inputProps={{
          name: "name",
          onChange: (event) => updateName(event.target.value),
          required: true,
          value: name,
        }}
      />
      <FormField
        id="room-slug"
        label="Identificador (slug)"
        hint="Se genera automáticamente desde el nombre; puedes editarlo."
        inputProps={{
          onChange: (event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          },
          value: slug,
        }}
      />
      <FormField
        id="room-description"
        label="Descripción"
        inputProps={{ name: "description" }}
      />
      <div className="grid gap-4 tablet:grid-cols-2">
        <FormField
          id="room-capacity"
          label="Capacidad"
          inputProps={{ min: 1, name: "capacity", type: "number" }}
        />
        <FormField
          id="room-bed-count"
          label="Cantidad de camas"
          inputProps={{ min: 1, name: "bedCount", type: "number" }}
        />
        <FormField
          id="room-bed-configuration"
          label="Configuración de camas"
          inputProps={{ name: "bedConfiguration" }}
        />
        <FormField
          id="room-bathroom"
          label="Descripción del baño"
          inputProps={{ name: "bathroomDescription" }}
        />
        <FormField
          id="room-price"
          label="Precio por noche (CLP)"
          inputProps={{ min: 0, name: "baseNightlyPriceClp", type: "number" }}
        />
      </div>
      <fieldset className="space-y-2">
        <legend className="block font-sans text-label font-semibold text-foreground">
          Amenities
        </legend>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-body">
          {amenities.map((amenity) => (
            <li key={amenity.id} className="flex items-center gap-2">
              <input
                checked={selectedAmenityIds.includes(amenity.id)}
                className="size-4"
                id={`amenity-${amenity.id}`}
                onChange={(event) =>
                  toggleAmenity(amenity.id, event.target.checked)
                }
                type="checkbox"
              />
              <label htmlFor={`amenity-${amenity.id}`}>{amenity.name}</label>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-3">
          <FormField
            id="new-amenity-name"
            label="Nueva amenidad"
            inputProps={{
              onChange: (event) => setNewAmenityName(event.target.value),
              value: newAmenityName,
            }}
          />
          <Button
            disabled={addingAmenity || !newAmenityName.trim()}
            loading={addingAmenity}
            onClick={addAmenity}
            type="button"
          >
            Agregar
          </Button>
        </div>
      </fieldset>
      {error ? (
        <Feedback variant="error" title="No pudimos crear la habitación">
          {error}
        </Feedback>
      ) : null}
      <Button disabled={pending} loading={pending} type="submit">
        Crear borrador
      </Button>
    </form>
  );
}
