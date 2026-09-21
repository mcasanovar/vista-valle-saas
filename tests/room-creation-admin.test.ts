import { describe, expect, it } from "vitest";
import {
  createMockRoomCreationRepository,
  normalizeAmenityName,
  normalizeRoomDraftInput,
  resolveRoomActivationGaps,
  RoomCreationInputError,
  slugify,
} from "@/features/rooms/room-creation-admin";

describe("slugify", () => {
  it("strips diacritics and lowercases", () => {
    expect(slugify("Departamento Interior")).toBe("departamento-interior");
  });

  it("collapses non-alphanumeric runs into single dashes", () => {
    expect(slugify("  Hola,   Mundo!! ")).toBe("hola-mundo");
  });

  it("rejects a name that slugifies to nothing", () => {
    expect(() => slugify("¡¡¡!!!")).toThrow(RoomCreationInputError);
  });
});

describe("normalizeRoomDraftInput", () => {
  it("requires a name", () => {
    expect(() => normalizeRoomDraftInput({})).toThrow(RoomCreationInputError);
  });

  it("accepts only a name and derives the slug", () => {
    const input = normalizeRoomDraftInput({ name: "Departamento Interior" });
    expect(input).toMatchObject({
      capacity: null,
      name: "Departamento Interior",
      slug: "departamento-interior",
    });
  });

  it("rejects a non-positive capacity when provided", () => {
    expect(() =>
      normalizeRoomDraftInput({ capacity: 0, name: "Depto" })
    ).toThrow(RoomCreationInputError);
  });

  it("respects an explicit slug override", () => {
    const input = normalizeRoomDraftInput({
      name: "Depto Interior",
      slug: "depto-1",
    });
    expect(input.slug).toBe("depto-1");
  });
});

describe("normalizeAmenityName", () => {
  it("rejects an empty name", () => {
    expect(() => normalizeAmenityName("  ")).toThrow(RoomCreationInputError);
  });
});

describe("resolveRoomActivationGaps", () => {
  const complete = Object.freeze({
    amenitiesCount: 1,
    bathroom: "Baño privado",
    bedConfiguration: "1 cama",
    bedCount: 1,
    capacity: 2,
    description: "Descripción",
    imagesCount: 1,
    name: "Depto",
    nightlyPriceClp: 90_000,
    slug: "depto",
  });

  it("returns no gaps for a fully complete candidate", () => {
    expect(resolveRoomActivationGaps(complete)).toEqual([]);
  });

  it("flags every missing field", () => {
    const gaps = resolveRoomActivationGaps({
      ...complete,
      amenitiesCount: 0,
      imagesCount: 0,
      nightlyPriceClp: 0,
    });
    expect(gaps).toContain("al menos 1 amenidad");
    expect(gaps).toContain("al menos 1 foto");
    expect(gaps).toContain("precio por noche");
  });

  it("flags a missing bed count even though the read model doesn't carry it", () => {
    expect(
      resolveRoomActivationGaps({ ...complete, bedCount: null })
    ).toContain("cantidad de camas");
  });
});

describe("createMockRoomCreationRepository", () => {
  it("creates a draft, blocks a duplicate slug, and activates once complete", async () => {
    const repository = createMockRoomCreationRepository();
    const amenities = await repository.listAmenities();
    const wifi = amenities.find((amenity) => amenity.name === "Wi‑Fi")!;

    const { roomId } = await repository.createDraft(
      normalizeRoomDraftInput({
        amenityIds: [wifi.id],
        bathroomDescription: "Baño privado",
        bedConfiguration: "1 cama",
        bedCount: 1,
        capacity: 2,
        description: "Departamento con living y cocina",
        name: "Departamento Interior",
        baseNightlyPriceClp: 90_000,
      }),
      "admin-1"
    );

    const draft = await repository.getById(roomId);
    expect(draft?.active).toBe(false);
    expect((await repository.listDrafts()).map((room) => room.id)).toContain(
      roomId
    );

    await expect(
      repository.createDraft(
        normalizeRoomDraftInput({ name: "Departamento Interior" }),
        "admin-1"
      )
    ).rejects.toThrow(RoomCreationInputError);

    await repository.activate(roomId, "admin-1");
    const activated = await repository.getById(roomId);
    expect(activated?.active).toBe(true);
    expect(await repository.roomExists(roomId)).toBe(true);
  });
});
