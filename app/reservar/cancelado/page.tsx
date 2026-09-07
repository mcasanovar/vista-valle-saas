import type { Metadata } from "next";
import Link from "next/link";

import { Feedback, Heading } from "@/presentation/atoms";

export const metadata: Metadata = {
  title: "Pago cancelado",
  robots: { index: false, follow: true },
};

export default function FintocCancelledPage() {
  return (
    <main className="min-h-dvh bg-warm text-foreground">
      <div className="mx-auto max-w-content space-y-4 px-4 py-16 text-center">
        <Heading level={1}>Pago cancelado</Heading>
        <Feedback variant="warning" title="No completaste el pago en línea">
          Tu habitación sigue disponible por unos minutos. Puedes intentar
          pagar nuevamente o elegir pagar al llegar.
        </Feedback>
        <Link
          href="/"
          className="inline-block font-sans text-body text-primary underline-offset-4 hover:underline"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
