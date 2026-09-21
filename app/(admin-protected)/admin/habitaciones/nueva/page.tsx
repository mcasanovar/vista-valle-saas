import { ActionLink, Heading, Text } from "@/presentation/atoms";
import { getCanonicalMockRoomCreationRepository } from "@/features/rooms";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDrizzleRoomCreationRepository } from "@/infrastructure/database/room-creation-repository";
import { RoomCreationForm } from "@/features/rooms/room-creation-form";
import { createAmenityAction, createRoomDraftAction } from "@/features/rooms/actions";

export const dynamic = "force-dynamic";

async function loadInitialAmenities() {
  const boundary = createDatabaseBoundary();
  const repository =
    boundary.context === "mock"
      ? getCanonicalMockRoomCreationRepository()
      : createDrizzleRoomCreationRepository(createProductionDatabase(boundary));
  return repository.listAmenities();
}

export default async function NewRoomPage() {
  const initialAmenities = await loadInitialAmenities();

  return (
    <section className="space-y-5 tablet:space-y-6">
      <ActionLink href="/admin/habitaciones">← Volver a habitaciones</ActionLink>
      <header>
        <Heading level={1} className="font-heading text-title">
          Nueva habitación
        </Heading>
        <Text className="mt-1 text-muted-foreground">
          Crea el borrador con los datos que tengas a mano. Podrás subir fotos
          y activarla más tarde, cuando esté completa.
        </Text>
      </header>
      <RoomCreationForm
        action={createRoomDraftAction}
        createAmenity={createAmenityAction}
        initialAmenities={initialAmenities}
      />
    </section>
  );
}
