"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Heading, Text } from "@/presentation/atoms";

const AUTO_CLOSE_SECONDS = 5;
const LANDING_PATH = "/";
const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Confirms a successful quotation submission without repeating amounts or
 * room detail — that summary only lives in the confirmation email (see
 * design.md decision 6). Every way of closing it (button, backdrop click,
 * Escape, or the 5s timer) routes through the same `closeAndRedirect` so the
 * landing-page redirect always happens exactly once. The visible countdown
 * runs on a parallel 1s interval so the timer that triggers the close never
 * has its side effect gated behind a state update.
 */
export function CompanyQuotationConfirmationModal() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closedRef = useRef(false);
  const [secondsRemaining, setSecondsRemaining] = useState(
    AUTO_CLOSE_SECONDS
  );

  const closeAndRedirect = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    router.push(LANDING_PATH);
  }, [router]);
  const closeAndRedirectRef = useRef(closeAndRedirect);
  useEffect(() => {
    closeAndRedirectRef.current = closeAndRedirect;
  }, [closeAndRedirect]);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const timeout = setTimeout(
      () => closeAndRedirectRef.current(),
      AUTO_CLOSE_SECONDS * 1000
    );
    const interval = setInterval(() => {
      setSecondsRemaining((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeAndRedirectRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        FOCUSABLE_SELECTOR
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeAndRedirect();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Cotización enviada"
        className="w-full max-w-md space-y-4 rounded-xl bg-card p-6 shadow-lg"
      >
        <Heading level={2}>Cotización enviada</Heading>
        <Text className="text-muted-foreground">
          Enviamos la confirmación de tu cotización al correo indicado.
          Revisa tu bandeja de entrada para ver el detalle completo.
        </Text>
        <Text aria-live="polite" className="text-sm text-muted-foreground">
          Esta ventana se cerrará automáticamente en {secondsRemaining}{" "}
          {secondsRemaining === 1 ? "segundo" : "segundos"}.
        </Text>
        <Button ref={closeButtonRef} onClick={closeAndRedirect} type="button">
          Cerrar
        </Button>
      </div>
    </div>
  );
}
