import Link from "next/link";
import { ActionLink, VistaValleBrand } from "@/presentation/atoms";
import { MobileNavigation } from "./mobile-navigation";
import { ThemeToggle } from "./theme-toggle";

export type PublicNavigationItem = Readonly<{ href: string; label: string }>;

export function PublicHeader({
  brandLabel,
  homeHref,
  items,
  bookingHref,
  bookingLabel,
}: {
  brandLabel: string;
  homeHref: string;
  items: readonly PublicNavigationItem[];
  bookingHref: string;
  bookingLabel: string;
}) {
  return (
    <header className="sticky top-0 z-30 bg-warm/95 shadow-sm backdrop-blur">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-card p-3 text-foreground shadow-md focus:not-sr-only"
      >
        Saltar al contenido
      </a>
      <nav
        aria-label="Navegación principal"
        className="mx-auto grid min-h-[4.5rem] max-w-content grid-cols-[1fr_auto_auto] items-center gap-3 px-4 phone:px-6 tablet:px-8 laptop:grid-cols-[1fr_auto_1fr]"
      >
        <Link
          href={homeHref}
          aria-label={brandLabel}
          className="justify-self-start rounded-md text-primary"
        >
          <VistaValleBrand />
        </Link>
        <ul className="hidden gap-6 laptop:flex">
          {items.map((item) => (
            <li key={item.href}>
              <ActionLink href={item.href}>{item.label}</ActionLink>
            </li>
          ))}
        </ul>
        <MobileNavigation items={items} />
        <div className="flex items-center gap-2 justify-self-end">
          <ThemeToggle />
          <ActionLink
            href={bookingHref}
            variant="action"
            className="whitespace-nowrap"
          >
            {bookingLabel}
          </ActionLink>
        </div>
      </nav>
    </header>
  );
}
