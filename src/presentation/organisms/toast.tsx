"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";

export type ToastVariant = "success" | "error";

type Toast = Readonly<{ id: number; message: string; variant: ToastVariant }>;

type ToastContextValue = Readonly<{
  notify: (variant: ToastVariant, message: string) => void;
}>;

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;

const variantStyles: Record<
  ToastVariant,
  Readonly<{ background: string; foreground: string; icon: typeof CheckCircle2 }>
> = {
  error: {
    background: "var(--admin-danger-background, #fbe9e7)",
    foreground: "var(--admin-danger, #c25b4c)",
    icon: XCircle,
  },
  success: {
    background: "var(--admin-success-background, #e6f4ea)",
    foreground: "var(--admin-success, #2f8f5b)",
    icon: CheckCircle2,
  },
};

/** Global, top-right action feedback for the admin panel. */
export function ToastProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [toasts, setToasts] = useState<readonly Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = ++nextId.current;
      setToasts((current) => [...current, { id, message, variant }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-4 top-4 z-50 flex flex-col items-end gap-2 phone:inset-x-auto phone:right-4"
      >
        {toasts.map((toast) => {
          const styles = variantStyles[toast.variant];
          const Icon = styles.icon;
          return (
            <div
              key={toast.id}
              role={toast.variant === "error" ? "alert" : "status"}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border border-transparent px-3.5 py-3 text-sm font-semibold shadow-lg"
              style={{
                background: styles.background,
                color: styles.foreground,
              }}
            >
              <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <p className="flex-1">{toast.message}</p>
              <button
                aria-label="Cerrar notificación"
                onClick={() => dismiss(toast.id)}
                type="button"
                className="-m-1 rounded p-1 hover:opacity-70"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
