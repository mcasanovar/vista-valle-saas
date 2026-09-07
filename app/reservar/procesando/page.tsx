import type { Metadata } from "next";
import { Suspense } from "react";

import { LoadingState } from "@/presentation/atoms";
import { FintocProcessingController } from "@/features/payments/fintoc-processing-controller";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Procesando pago",
  robots: { index: false, follow: true },
};

export default function FintocProcessingPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-warm text-foreground">
      <Suspense
        fallback={
          <div className="mx-auto max-w-content px-4 py-16 text-center">
            <LoadingState />
          </div>
        }
      >
        <FintocProcessingController />
      </Suspense>
    </main>
  );
}
