"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { ToastProvider } from "@/presentation/organisms";
import {
  CalendarDays,
  CircleAlert,
  Ellipsis,
  House,
  LayoutDashboard,
  type LucideIcon,
  PlusSquare,
  Power,
  LogOut,
  RefreshCw,
  ScrollText,
  Settings,
} from "lucide-react";

type NavigationItem = Readonly<{
  href: string;
  label: string;
  icon: LucideIcon;
}>;

const navigationGroups: ReadonlyArray<
  Readonly<{ label: string; items: readonly NavigationItem[] }>
> = [
  {
    label: "OPERACIÓN",
    items: [
      { href: "/admin", label: "Resumen", icon: LayoutDashboard },
      { href: "/admin/calendario", label: "Calendario", icon: CalendarDays },
      { href: "/admin/reservas", label: "Reservas", icon: ScrollText },
      {
        href: "/admin/reservas/nueva",
        label: "Nueva reserva",
        icon: PlusSquare,
      },
    ],
  },
  {
    label: "SISTEMA",
    items: [
      { href: "/admin/bloqueos", label: "Bloqueos", icon: Power },
      {
        href: "/admin/sincronizaciones",
        label: "Sincronizaciones",
        icon: RefreshCw,
      },
      { href: "/admin/alertas", label: "Alertas", icon: CircleAlert },
      { href: "/admin/configuracion", label: "Configuración", icon: Settings },
    ],
  },
] as const;

const allItems = navigationGroups.flatMap((group) => group.items);
// Bottom nav shows exactly Resumen, Calendario, Reservas, Alertas (per
// design/admin-dashboards/Mobile.dc.html); every other section is reachable
// through "Más" below.
const mobileItems: readonly NavigationItem[] = [
  navigationGroups[0].items[0],
  navigationGroups[0].items[1],
  navigationGroups[0].items[2],
  navigationGroups[1].items[2],
] as const;

function isActiveRoute(pathname: string, href: string) {
  const matches =
    href === "/admin"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    matches &&
    !allItems.some(
      (item) =>
        item.href !== href &&
        item.href.startsWith(`${href}/`) &&
        (pathname === item.href || pathname.startsWith(`${item.href}/`))
    )
  );
}

function initials(email?: string) {
  const value = email?.split("@")[0]?.trim();
  return value ? value.slice(0, 2).toUpperCase() : "AD";
}

export function AdminShell({
  children,
  email,
}: Readonly<{ children: ReactNode; email?: string }>) {
  const pathname = usePathname();
  const router = useRouter();
  const currentPath = pathname ?? "/admin";
  const logout = async () => {
    try {
      await fetch("/api/admin/auth/logout", {
        credentials: "same-origin",
        method: "POST",
      });
    } catch {
      // The client still follows the fixed safe exit path.
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  };

  return (
    <div
      data-theme="admin"
      className="admin-shell min-h-screen bg-background text-foreground"
    >
      <ToastProvider>
        <a className="sr-only focus:not-sr-only" href="#admin-content">
          Saltar al contenido
        </a>

        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-[var(--admin-sidebar)] px-3.5 py-6 laptop:flex">
          <div className="flex items-center gap-2.5 px-2.5 pb-6">
            <div className="flex size-8 items-center justify-center rounded-lg bg-accent text-on-accent">
              <House aria-hidden="true" className="size-[18px]" />
            </div>
            <div>
              <p className="font-heading text-sm font-extrabold tracking-wide text-[#f2f3f7]">
                Vista Valle
              </p>
              <p className="text-[11px] text-[#8890a6]">Panel de gestión</p>
            </div>
          </div>
          <nav
            aria-label="Navegación administrativa"
            className="flex flex-col gap-1"
          >
            {navigationGroups.map((group, groupIndex) => (
              <div key={group.label} className={groupIndex === 1 ? "pt-3" : ""}>
                <p className="px-3 pb-1.5 pt-2.5 text-[11px] font-bold tracking-[0.06em] text-[var(--admin-sidebar-heading)]">
                  {group.label}
                </p>
                {group.items.map(({ href, icon: Icon, label }) => {
                  const active = isActiveRoute(currentPath, href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className="admin-nav-link flex min-h-11 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon
                        aria-hidden="true"
                        className="size-[17px] shrink-0"
                      />
                      <span>{label}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
          <div className="mt-auto flex items-center gap-2.5 border-t border-[var(--admin-sidebar-border)] px-3 pt-3">
            <div className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-on-accent">
              {initials(email)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[var(--admin-sidebar-active-foreground)]">
                {email ?? "Administrador"}
              </p>
              <p className="text-[11px] text-[#8890a6]">Administración</p>
            </div>
            <button
              aria-label="Cerrar sesión"
              className="ml-auto flex size-11 items-center justify-center rounded-lg text-[var(--admin-sidebar-foreground)] hover:bg-[var(--admin-sidebar-active)] hover:text-[var(--admin-sidebar-active-foreground)]"
              onClick={logout}
              type="button"
            >
              <LogOut aria-hidden="true" className="size-4" />
            </button>
          </div>
        </aside>

        <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col items-center gap-1.5 bg-[var(--admin-sidebar)] py-4 tablet:flex laptop:hidden">
          <div className="mb-3.5 flex size-8 items-center justify-center rounded-lg bg-accent text-on-accent">
            <House aria-hidden="true" className="size-[17px]" />
          </div>
          <nav
            aria-label="Navegación administrativa compacta"
            className="flex flex-col gap-1.5"
          >
            {allItems.map(({ href, icon: Icon, label }) => {
              const active = isActiveRoute(currentPath, href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-label={label}
                  title={label}
                  aria-current={active ? "page" : undefined}
                  className="admin-nav-link flex size-11 items-center justify-center rounded-[9px] transition-colors"
                >
                  <Icon aria-hidden="true" className="size-[17px]" />
                </Link>
              );
            })}
          </nav>
          <div
            className="mt-auto flex size-8 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-on-accent"
            title={email ?? "Administrador"}
          >
            {initials(email)}
          </div>
          <button
            aria-label="Cerrar sesión"
            className="flex size-11 items-center justify-center rounded-[9px] text-[var(--admin-sidebar-foreground)] hover:bg-[var(--admin-sidebar-active)] hover:text-[var(--admin-sidebar-active-foreground)]"
            onClick={logout}
            type="button"
          >
            <LogOut aria-hidden="true" className="size-4" />
          </button>
        </aside>

        <main
          id="admin-content"
          className="min-h-screen px-4 py-5 pb-[calc(5.75rem+env(safe-area-inset-bottom))] phone:px-6 tablet:pl-[5.5rem] tablet:pr-[1.375rem] tablet:pt-[1.375rem] tablet:pb-7 laptop:pl-[17.25rem] laptop:pr-9 laptop:pt-7 laptop:pb-9"
        >
          {children}
        </main>

        <nav
          aria-label="Navegación administrativa móvil"
          className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[var(--admin-surface-border)] bg-card px-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 tablet:hidden"
        >
          {mobileItems.map(({ href, icon: Icon, label }) => {
            const active = isActiveRoute(currentPath, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                  active ? "text-accent" : "text-[#8890a6]"
                }`}
              >
                <Icon aria-hidden="true" className="size-5" />
                <span>{label}</span>
              </Link>
            );
          })}
          <details className="group relative flex min-w-0 flex-1">
            <summary
              aria-label="Más secciones administrativas"
              className={`flex min-h-11 w-full list-none flex-col items-center justify-center gap-0.5 text-[11px] font-semibold marker:hidden [&::-webkit-details-marker]:hidden ${
                allItems
                  .filter(
                    ({ href }) =>
                      !mobileItems.some(
                        (mobileItem) => mobileItem.href === href
                      )
                  )
                  .some(({ href }) => isActiveRoute(currentPath, href))
                  ? "text-accent"
                  : "text-[#8890a6]"
              }`}
            >
              <Ellipsis aria-hidden="true" className="size-5" />
              <span>Más</span>
            </summary>
            <div className="absolute bottom-[calc(100%+0.75rem)] right-1 w-56 rounded-xl border border-[var(--admin-surface-border)] bg-card p-2 shadow-lg">
              {allItems
                .filter(
                  ({ href }) =>
                    !mobileItems.some((mobileItem) => mobileItem.href === href)
                )
                .map(({ href, icon: Icon, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-foreground hover:bg-muted"
                  >
                    <Icon aria-hidden="true" className="size-4" />
                    {label}
                  </Link>
                ))}
              <button
                className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-foreground hover:bg-muted"
                onClick={logout}
                type="button"
              >
                <LogOut aria-hidden="true" className="size-4" />
                Cerrar sesión
              </button>
            </div>
          </details>
        </nav>
      </ToastProvider>
    </div>
  );
}
