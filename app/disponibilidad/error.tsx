"use client";

import { useEffect } from "react";
import { Button, Feedback, Heading } from "@/presentation/atoms";

export default function AvailabilityError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    // Keep provider and request details out of the browser-facing error state.
    console.error("Availability results failed", error.digest);
  }, [error.digest]);

  return (
    <main
      id="main-content"
      className="mx-auto max-w-content space-y-6 bg-background px-4 py-10 phone:px-6 tablet:px-8 tablet:py-14"
    >
      <Heading level={1}>Disponibilidad</Heading>
      <Feedback variant="error" title="No pudimos cargar los resultados">
        Intenta nuevamente. Tus criterios de búsqueda se mantienen en la URL.
        <div className="mt-4">
          <Button type="button" onClick={reset}>
            Reintentar
          </Button>
        </div>
      </Feedback>
    </main>
  );
}
