## Why

La pantalla Resumen del panel admin solo permite ver los indicadores de un mes a la vez. Para revisar el desempeño de un año completo (ej. comparar 2025 contra 2024, o ver el total anual), un administrador tendría que sumar manualmente doce meses uno por uno. Se necesita un filtro de nivel superior por año que muestre el resumen anual completo y desde el cual se pueda seguir acotando a un mes específico de ese año.

## What Changes

- Se agrega un selector de año en la pantalla Resumen, por encima del selector de mes existente.
- Al elegir un año, el resumen operativo (tarjetas KPI salvo alertas abiertas, canceladas, no-show, desglose por canal, ocupación por habitación y gráfico de ventas) se recalcula para todo ese año, y el selector de mes pasa a mostrar el valor "Año completo".
- Desde "Año completo" se puede seguir eligiendo un mes específico de ese mismo año para volver a la vista mensual actual.
- Volver a elegir "Año completo" en el selector de mes regresa a la vista anual del año seleccionado, sin perder el año elegido.
- La tabla de reservas recientes y el indicador de alertas abiertas siguen sin filtrarse por período (mismo comportamiento actual).
- La URL de la pantalla Resumen refleja el período seleccionado (año, o año+mes) para que se pueda compartir o recargar sin perder el filtro.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `admin-dashboard-shell`: el requirement "Selector de mes en la pantalla Resumen" se amplía con un selector de año de nivel superior y un valor "Año completo" en el selector de mes; los requirements de tarjetas KPI, cancelaciones/no-show, desglose por canal, ocupación por habitación y gráfico de ventas se generalizan de "mes seleccionado" a "período seleccionado" (mes o año completo).

## Impact

- `src/features/admin/dashboard.ts`: reemplaza `resolveAdminDashboardMonth`/`getAdminDashboardSummary(month)` por una resolución de período (año, o año+mes) y un rango de fechas anual además del mensual ya existente.
- `src/infrastructure/database/admin-dashboard-summary-source.ts`: el agregador de producción ya trabaja sobre un rango `{from, to}` genérico, por lo que no requiere cambios de consulta, solo el nuevo cálculo de rango anual en `dashboard.ts`.
- `app/api/admin/dashboard/route.ts`: acepta `year` (y `month` opcional) como parámetros de consulta.
- `app/(admin-protected)/admin/page.tsx`: resuelve el período inicial (año y mes) desde `searchParams` en vez de solo `month`.
- `src/features/admin/admin-dashboard-view.tsx`: agrega el selector de año, convierte el selector de mes para incluir la opción "Año completo", y actualiza la URL con el período vigente.
- `tests/admin-dashboard-summary.test.tsx` y pruebas relacionadas de agregación mock: cobertura para el rango anual y para las transiciones año → año completo → mes.
