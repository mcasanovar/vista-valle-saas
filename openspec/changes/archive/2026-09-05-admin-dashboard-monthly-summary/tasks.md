## 1. Fuente de datos real de producción

- [x] 1.1 Crear `src/infrastructure/database/admin-dashboard-summary-source.ts` con la consulta de ganado del mes, reservas del mes, canceladas y no-show (agrupada por `status`, monto de pagos `approved`, acotada a `checkIn` del mes); verificar con un test de integración Postgres siguiendo el patrón de `postgres-admin-pending-payments.integration.test.ts`.
- [x] 1.2 Agregar la consulta de desglose por canal (`origin`, cantidad y monto aprobado, solo `confirmed`/`completed`); verificar con un test que un canal sin reservas en el mes aparece en cero en vez de desaparecer del resultado.
- [x] 1.3 Agregar la consulta de ocupación por habitación (noches cubiertas por reservas `confirmed`/`completed` con al menos un pago `approved`, sobre noches disponibles usando `rooms.active` + `rooms.createdAt` como cota de inicio); verificar con tests que una reserva confirmada sin pago aprobado no suma noches y que una habitación con `active = false` se excluye del desglose.
- [x] 1.4 Agregar la consulta de ventas por día del mes agrupando pagos `approved` por `checkIn`, rellenando en cero cada día sin ventas antes de devolver el resultado; verificar con un test que un mes sin ventas aprobadas se distingue explícitamente de un mes con datos.

## 2. Encadenar el filtro de mes en el servidor

- [x] 2.1 Actualizar `src/features/admin/dashboard.ts`: implementar la rama de producción (hoy `return null`) llamando a `admin-dashboard-summary-source.ts`, aceptando un `month` (`YYYY-MM`, default: mes calendario actual en `America/Santiago`), y actualizar `AdminDashboardSummary`/`AdminDashboardKpis` con los nuevos campos (total ganado, reservas del mes, canceladas, no-show, por canal, por habitación, ventas por día); verificar que la suite de Vitest existente se actualiza para el nuevo shape y pasa.
- [x] 2.2 Actualizar `app/api/admin/dashboard/route.ts` para leer `?month=` de la query string, validar el formato y pasarlo a `getAdminDashboardSummary`; verificar con un test de la ruta que un `month` ausente o inválido cae al mes actual sin lanzar error.
- [x] 2.3 Actualizar `app/(admin-protected)/admin/page.tsx` para leer `searchParams.month` y pasarlo a `getAdminDashboardSummary`, siguiendo el mismo patrón que `app/(admin-protected)/admin/reservas/page.tsx`; verificar manualmente que `/admin?month=2026-08` renderiza los datos de agosto en el primer render de servidor.

## 3. UI de la pantalla Resumen

- [x] 3.1 Agregar el selector de mes (navegación anterior/siguiente) en `admin-dashboard-view.tsx`, que actualiza la URL (`?month=`) y dispara el refetch de las secciones dependientes del mes; verificar con un test de componente que cambiar de mes no mezcla momentáneamente valores del mes anterior con el nuevo mes (debe mostrar shimmer mientras carga).
- [x] 3.2 Ajustar las cuatro tarjetas KPI a los nuevos indicadores (total ganado, reservas del mes, ocupación promedio, alertas abiertas), manteniendo alertas abiertas sin filtrar por mes; actualizar `tests/admin-dashboard-summary.test.tsx` para el nuevo shape y verificar que pasa.
- [x] 3.3 Construir el componente de desglose por canal (barra proporcional al monto + badge numérico de cantidad en el mismo elemento), con la paleta ya aprobada en `proposes/admin-dashboard-design-notes.md`; verificar con un test de componente que monto y cantidad son ambos visibles y distinguibles para cada canal.
- [x] 3.4 Construir el componente de ocupación por habitación (lista de habitaciones con barra de porcentaje); verificar con un test que una habitación sin ocupación en el mes se muestra en 0%, no se omite de la lista.
- [x] 3.5 Construir el gráfico de ventas por día como SVG propio renderizado en servidor (sin nueva dependencia de gráficos), incluyendo el estado explícito "sin ventas registradas en el mes"; verificar con un test de render que un mes sin pagos aprobados muestra ese mensaje en vez de un gráfico vacío.
- [x] 3.6 Agregar shimmer/skeleton a las tres secciones nuevas durante la carga inicial y durante el cambio de mes, reutilizando la clase `admin-dashboard-shimmer` ya existente; verificar con un test que el bloque shimmer está presente mientras el estado de carga es verdadero.

## 4. Cobertura de extremo a extremo y regresión

- [x] 4.1 Sembrar datos de prueba para los escenarios clave de `openspec/changes/admin-dashboard-monthly-summary/specs/admin-dashboard-shell/spec.md` (reserva pagada por adelantado para un mes futuro, cancelada, no-show, canal sin reservas, habitación inactiva) y verificar cada escenario con un test de integración Postgres.
- [x] 4.2 Agregar cobertura Playwright que visite `/admin`, cambie de mes con el selector y confirme que las tarjetas KPI, el desglose por canal, la ocupación por habitación y el gráfico de ventas reflejan el mes seleccionado, mientras alertas abiertas y la tabla de reservas recientes permanecen sin cambios.
- [x] 4.3 Ejecutar la suite completa (Vitest y Playwright) y confirmar que no hay regresiones en las pruebas existentes de `admin-dashboard.test.tsx` y `admin-dashboard-summary.test.tsx` tras el cambio de shape del resumen.
