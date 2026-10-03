"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

const GENERIC_ERROR = "No fue posible iniciar sesión.";

/**
 * Reads its pending state from `useFormStatus`, not from a `useState` in the
 * parent: React does not paint a state update made inside a `<form action>`
 * callback until that callback's promise settles (harden-admin-authentication,
 * task 14.1), so a manually managed "loading" flag never shows up while the
 * request is actually in flight. `useFormStatus` is built for exactly this
 * and reflects the pending submission immediately — it must be read in a
 * component nested under the `<form>`, hence the split.
 */
function LoginSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      aria-busy={pending}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 font-semibold text-on-accent disabled:cursor-not-allowed disabled:opacity-70"
      disabled={pending}
      type="submit"
    >
      {pending ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin" />
      ) : null}
      {pending ? "Ingresando…" : "Ingresar"}
    </button>
  );
}

export function AdminLoginForm({
  context,
}: Readonly<{ context: "mock" | "production" }>) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const alertRef = useRef<HTMLParagraphElement>(null);
  // A ref, not state: it must block a second submission synchronously, the
  // instant the first one starts, regardless of when React next paints.
  const submittingRef = useRef(false);

  useEffect(() => {
    if (error) alertRef.current?.focus();
  }, [error]);

  if (context === "mock") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg items-center p-6">
        <section className="w-full rounded-xl border border-border bg-card p-6 shadow-md">
          <h1 className="font-heading text-display text-primary">
            Acceso administrativo
          </h1>
          <p className="mt-3 text-muted-foreground">
            El entorno de desarrollo usa una sesión administrativa mock. No se
            aceptan credenciales de prueba.
          </p>
          <Link
            href="/admin"
            className="mt-6 inline-flex min-h-11 items-center rounded-md bg-accent px-4 font-semibold text-on-accent"
          >
            Abrir panel de desarrollo
          </Link>
        </section>
      </main>
    );
  }

  async function submit(formData: FormData) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setError(null);
    try {
      const response = await fetch("/api/admin/auth/login", {
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body: unknown = await response.json().catch(() => null);
      if (
        !response.ok ||
        !body ||
        typeof body !== "object" ||
        !("ok" in body) ||
        body.ok !== true
      ) {
        setError(GENERIC_ERROR);
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      submittingRef.current = false;
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center p-6">
      <section className="w-full rounded-xl border border-border bg-card p-6 shadow-md">
        <h1 className="font-heading text-display text-primary">
          Acceso administrativo
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ingresa con tu cuenta administrativa autorizada.
        </p>
        <form
          action={submit}
          className="mt-6 space-y-4"
          aria-label="Inicio de sesión administrativo"
        >
          <div>
            <label
              className="block text-sm font-semibold"
              htmlFor="admin-email"
            >
              Correo electrónico
            </label>
            <input
              autoComplete="email"
              className="mt-1 min-h-11 w-full rounded-md border border-border px-3"
              id="admin-email"
              name="email"
              required
              type="email"
            />
          </div>
          <div>
            <label
              className="block text-sm font-semibold"
              htmlFor="admin-password"
            >
              Contraseña
            </label>
            <input
              autoComplete="current-password"
              className="mt-1 min-h-11 w-full rounded-md border border-border px-3"
              id="admin-password"
              name="password"
              required
              type="password"
            />
          </div>
          {error ? (
            <p
              ref={alertRef}
              role="alert"
              tabIndex={-1}
              className="rounded-md bg-[var(--admin-reservation-cancelled-background)] p-3 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          <LoginSubmitButton />
        </form>
      </section>
    </main>
  );
}
