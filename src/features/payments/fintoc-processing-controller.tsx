"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button, Heading, Icon } from "@/presentation/atoms";
// eslint-disable-next-line architecture/feature-public-api -- this Client Component needs the browser-safe selection session only.
import { clearSessionRoomSelection } from "@/features/reservations/selection-session";

const ACCENT = "#B6976D";

type StatusResponse =
  | { status: "not_found" }
  | { status: "processing" }
  | { status: "confirmed"; publicId: string }
  | { status: "failed" };

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 60;

/** Client-side wiring only; polls the server for the outcome the webhook produces asynchronously (see `getFintocCheckoutStatus`). */
export function FintocProcessingController() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = searchParams?.get("payment");
  const attemptsRef = useRef(0);
  const [state, setState] = useState<StatusResponse["status"]>("processing");
  const visibleState = paymentId ? state : "not_found";

  useEffect(() => {
    if (!paymentId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/bookings/fintoc-checkout/status?payment=${encodeURIComponent(paymentId)}`
        );
        const body = (await response.json()) as StatusResponse;
        if (cancelled) return;

        if (body.status === "confirmed") {
          clearSessionRoomSelection();
          router.replace(`/reserva/${encodeURIComponent(body.publicId)}`);
          return;
        }
        if (body.status === "failed" || body.status === "not_found") {
          setState(body.status);
          return;
        }
        attemptsRef.current += 1;
        if (attemptsRef.current >= MAX_POLL_ATTEMPTS) {
          setState("failed");
          return;
        }
        setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch {
        if (!cancelled) setTimeout(() => void poll(), POLL_INTERVAL_MS);
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [paymentId, router]);

  if (visibleState === "processing") {
    return (
      <div className="mx-auto max-w-[34rem] px-4 py-16">
        <div
          className="animate-fade-in-up rounded-2xl border-2 bg-card p-8 text-center shadow-lg tablet:p-12"
          style={{ borderColor: ACCENT }}
        >
          <div
            role="status"
            aria-label="Confirmando tu pago"
            className="mx-auto mb-6 flex size-16 items-center justify-center rounded-full"
          >
            <span
              aria-hidden="true"
              className="size-16 animate-spin rounded-full border-4"
              style={{
                borderColor: "rgba(182, 151, 109, 0.18)",
                borderTopColor: ACCENT,
              }}
            />
          </div>
          <p
            className="mb-3 flex items-center justify-center gap-2 text-xs font-semibold tracking-[0.2em] uppercase"
            style={{ color: ACCENT }}
          >
            <span aria-hidden="true">•</span> Cargando{" "}
            <span aria-hidden="true">•</span>
          </p>
          <Heading level={1}>Confirmando tu pago…</Heading>
          <div className="my-4 flex items-center justify-center gap-3">
            <div
              className="h-px w-16 rounded-md opacity-50"
              style={{ backgroundColor: ACCENT }}
            />
            <span
              className="size-1.5 rotate-45"
              style={{ backgroundColor: ACCENT }}
            />
            <div
              className="h-px w-16 rounded-md opacity-50"
              style={{ backgroundColor: ACCENT }}
            />
          </div>
          <p className="text-body text-muted-foreground">
            Esto puede tardar unos segundos. No cierres esta página.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <div
              className="h-px w-10 rounded-md opacity-50"
              style={{ backgroundColor: ACCENT }}
            />
            <div
              className="flex size-11 shrink-0 items-center justify-center rounded-2xl border-2"
              style={{ borderColor: ACCENT }}
            >
              <Icon
                decorative
                name="CreditCard"
                className="size-5 text-[#B6976D]"
              />
            </div>
            <div
              className="h-px w-10 rounded-md opacity-50"
              style={{ backgroundColor: ACCENT }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[34rem] px-4 py-16">
      <div className="animate-fade-in-up space-y-4 rounded-2xl border-2 border-destructive/40 bg-card p-8 text-center shadow-lg tablet:p-12">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-destructive/10">
          <Icon decorative name="X" className="size-6 text-destructive" />
        </div>
        <Heading level={1}>No pudimos confirmar el pago</Heading>
        <p className="text-body text-muted-foreground">
          {visibleState === "not_found"
            ? "No encontramos este intento de pago."
            : "El pago no se completó o fue rechazado. Puedes intentarlo nuevamente."}
        </p>
        <Button type="button" onClick={() => router.push("/")}>
          Volver al inicio
        </Button>
      </div>
    </div>
  );
}
