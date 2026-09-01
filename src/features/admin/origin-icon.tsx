import {
  Building2,
  Globe,
  Home,
  MessageCircle,
  Phone,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import type { ReservationOrigin } from "@/features/reservations";

export const originIcons: Readonly<Record<ReservationOrigin, LucideIcon>> = {
  admin: UserCog,
  airbnb: Home,
  booking: Building2,
  phone: Phone,
  website: Globe,
  whatsapp: MessageCircle,
};

export const originLabels: Readonly<Record<ReservationOrigin, string>> = {
  admin: "Creada por el equipo",
  airbnb: "Airbnb",
  booking: "Booking.com",
  phone: "Teléfono",
  website: "Sitio web",
  whatsapp: "WhatsApp",
};

/**
 * Origin icon for a calendar bar (task 2.2). Decorative by default
 * (`aria-hidden`) because every call site pairs it with the origin label as
 * visible or `aria-label`led text nearby; pass `accessibleLabel` when the
 * icon appears with no such text alternative.
 */
export function OriginIcon({
  origin,
  className,
  accessibleLabel = false,
}: Readonly<{
  origin: ReservationOrigin;
  className?: string;
  accessibleLabel?: boolean;
}>) {
  const Icon = originIcons[origin];
  return accessibleLabel ? (
    <Icon aria-label={originLabels[origin]} className={className} role="img" />
  ) : (
    <Icon aria-hidden="true" className={className} />
  );
}
