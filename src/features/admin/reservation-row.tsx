"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Makes the whole `<tr>` clickable/keyboard-navigable to the reservation
 * detail, instead of only the guest-name cell.
 */
export function ReservationRow({
  href,
  children,
}: Readonly<{ href: string; children: ReactNode }>) {
  const router = useRouter();
  return (
    <tr
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        router.push(href);
      }}
      className="cursor-pointer border-b border-[#f2f3f7] last:border-0 hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      {children}
    </tr>
  );
}
