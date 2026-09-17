import "server-only";

import { z } from "zod";

import {
  getAdminDashboardSummary,
  resolveAdminDashboardPeriod,
  type AdminDashboardSummary,
} from "@/features/admin";

import type { AssistantToolDefinition } from "../tool-registry";

const schema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "must be YYYY-MM")
    .optional(),
  year: z.string().regex(/^\d{4}$/, "must be YYYY").optional(),
});

export type FinancialSummaryToolInput = z.infer<typeof schema>;

export type FinancialSummaryToolResult =
  | Readonly<{ success: true; summary: AdminDashboardSummary }>
  | Readonly<{ code: "unavailable"; message: string; success: false }>;

/**
 * `resumen_financiero` (task 5.4): calls `getAdminDashboardSummary`
 * directly — the same figures the dashboard page shows, never
 * recalculated here (proposal.md: "el ingreso aprobado coincide con el
 * que calcula el sistema").
 */
export function createFinancialSummaryTool(): AssistantToolDefinition<
  FinancialSummaryToolInput,
  FinancialSummaryToolResult
> {
  return Object.freeze({
    description:
      "Consulta el resumen financiero y de ocupación de un mes o un año (ingresos aprobados, ocupación, desglose por canal).",
    async handler(input): Promise<FinancialSummaryToolResult> {
      const period = resolveAdminDashboardPeriod(input);
      const summary = await getAdminDashboardSummary(period);
      if (!summary) {
        return Object.freeze({
          code: "unavailable" as const,
          message: "No pudimos calcular el resumen financiero.",
          success: false as const,
        });
      }
      return Object.freeze({ success: true as const, summary });
    },
    lane: "read",
    name: "resumen_financiero",
    schema,
  });
}
