import "server-only";

import { getServerEnvironment } from "@/config/server";
import {
  getOperationalAlerts,
  type OperationalAlert,
} from "@/features/admin/operational-alerts";
import {
  getAdminReservationSource,
  type AdminReservation,
} from "@/features/admin/reservations";

export type AdminDashboardKpis = Readonly<{
  activeReservations: number;
  occupancyPercentage: number;
  openAlerts: number;
  pendingPaymentsClp: number;
}>;

export type AdminRecentReservation = Readonly<{
  amountClp: number;
  checkIn: string;
  checkOut: string;
  guest: string;
  id: string;
  room: string;
  status: AdminReservation["status"];
}>;

export type AdminDashboardSummary = Readonly<{
  kpis: AdminDashboardKpis;
  recentReservations: readonly AdminRecentReservation[];
}>;

type AdminDashboardDependencies = Readonly<{
  listAlerts: () => Promise<readonly OperationalAlert[]>;
  listReservations: () => readonly AdminReservation[];
}>;

const dashboardDependencies: AdminDashboardDependencies = Object.freeze({
  listAlerts: async () => (await getOperationalAlerts()) ?? [],
  listReservations: () => getAdminReservationSource()?.list() ?? [],
});

function normalizeLimit(limit: number) {
  return Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
}

/**
 * The administrative source carries its creation timestamp, so the operator
 * sees a deterministic newest-first order without inferring chronology from
 * a lodging date.
 */
export function selectRecentAdminReservations(
  reservations: readonly AdminReservation[],
  limit: number
): readonly AdminRecentReservation[] {
  const maximum = normalizeLimit(limit);

  return Object.freeze(
    [...reservations]
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
      )
      .slice(0, maximum)
      .map((reservation) => {
        return Object.freeze({
          amountClp: reservation.totalClp,
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut,
          guest: reservation.guestName,
          id: reservation.id,
          room: reservation.room,
          status: reservation.status,
        });
      })
  );
}

export function createAdminDashboardSource(
  context: "mock" | "production",
  dependencies: AdminDashboardDependencies = dashboardDependencies
) {
  if (context !== "mock") return null;

  const getData = async (recentLimit = 5): Promise<AdminDashboardSummary> => {
    const reservations = dependencies.listReservations();
    const alerts = await dependencies.listAlerts();
    const activeReservations = reservations.filter(
      (reservation) => reservation.status !== "cancelled"
    ).length;

    return Object.freeze({
      kpis: Object.freeze({
        // Approximation: no room-inventory source exists in the mock yet, so
        // this is the share of active administrative reservations.
        occupancyPercentage:
          reservations.length === 0
            ? 0
            : Math.round((activeReservations / reservations.length) * 100),
        activeReservations,
        pendingPaymentsClp: reservations
          .filter((reservation) => reservation.paymentStatus === "pending")
          .reduce((total, reservation) => total + reservation.totalClp, 0),
        openAlerts: alerts.length,
      }),
      recentReservations: selectRecentAdminReservations(
        reservations,
        recentLimit
      ),
    });
  };

  return Object.freeze({
    getSummary: () => getData(),
    getRecentReservations: async (limit: number) =>
      (await getData(limit)).recentReservations,
  });
}

export async function getAdminDashboardSummary() {
  return (
    (await createAdminDashboardSource(
      getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT
    )?.getSummary()) ?? null
  );
}

export async function getAdminRecentReservations(limit: number) {
  return (
    (await createAdminDashboardSource(
      getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT
    )?.getRecentReservations(limit)) ?? null
  );
}
