## 1. Resolución de período y rango de fechas

- [x] 1.1 En `src/features/admin/dashboard.ts`, agregar `yearRange(year: number): AdminDashboardMonthRange` junto a `monthRange`, y verificar con una prueba unitaria que devuelve `{from: "YYYY-01-01", to: "YYYY-12-31"}`
- [x] 1.2 Reemplazar `resolveAdminDashboardMonth(month?)` por `resolveAdminDashboardPeriod({ year?, month? })` que devuelve `{ year: number; month: string | null }`, con el mes vigente como default cuando no se pasa ni `year` ni `month`, y verificar con pruebas unitarias los tres casos (sin params, solo `month`, solo `year`)
- [x] 1.3 Actualizar `AdminDashboardSummary.month: string` a `period: { year: number; month: string | null }` y propagar el tipo a `toSummary`, `createAdminDashboardSource` y `getAdminDashboardSummary`, eligiendo `monthRange`/`yearRange` según `period.month`, y verificar que `tests/admin-dashboard-summary.test.tsx` sigue pasando con el nuevo campo

## 2. API

- [x] 2.1 Actualizar `app/api/admin/dashboard/route.ts` para leer `year` y `month` de `searchParams` y pasarlos a `resolveAdminDashboardPeriod`, y verificar con una prueba de integración que `?year=2025` devuelve el resumen anual y `?month=2025-03` sigue devolviendo el resumen mensual como hoy

## 3. Página y vista

- [x] 3.1 Actualizar `app/(admin-protected)/admin/page.tsx` para resolver `year`/`month` desde `searchParams` con `resolveAdminDashboardPeriod` y pasar el período inicial a `AdminDashboardView`
- [x] 3.2 En `src/features/admin/admin-dashboard-view.tsx`, agregar `YearSelector` (mismo patrón visual de flechas que `MonthSelector`) y convertir `MonthSelector` en un `<select>` con "Año completo" + los 12 meses del año vigente, y verificar manualmente que el `<select>` lista las 13 opciones correctas para un año dado
- [x] 3.3 Implementar la transición de período: cambiar de año siempre deja el mes en "Año completo"; elegir un mes desde "Año completo" acota al mes elegido del año vigente; volver a elegir "Año completo" regresa a la vista anual conservando el año, y verificar cada transición con una prueba de componente (React Testing Library)
- [x] 3.4 Actualizar la URL con `history.replaceState` para reflejar `?year=YYYY` o `?year=YYYY&month=YYYY-MM` en cada cambio de período, y verificar manualmente que recargar la página con cada forma de URL restaura el período correspondiente
- [x] 3.5 Verificar que el estado de carga (shimmer) se activa igual al cambiar de año que al cambiar de mes, reutilizando el `loading`/`DashboardSkeleton` existente

## 4. Pruebas de agregación por rango anual

- [x] 4.1 Agregar una prueba unitaria para `aggregateMockMonthlySummary` con un rango de año completo (`yearRange`) que cubra reservas en distintos meses del mismo año, y verificar que el total ganado, el desglose por canal y la ocupación por habitación agregan correctamente los doce meses
- [x] 4.2 Agregar una prueba end-to-end (Playwright) que seleccione un año, confirme que el selector de mes muestra "Año completo" y los indicadores cambian a valores anuales, luego seleccione un mes de ese año y confirme el resumen mensual, y finalmente vuelva a "Año completo"

## 5. Documentación de specs

- [x] 5.1 Ejecutar `openspec validate admin-dashboard-year-filter --strict` y corregir cualquier problema de formato en la delta spec antes de considerar la planificación completa
