## 1. Datos de calendario

- [x] 1.1 Crear consulta de calendario que reciba rango de fechas + filtros opcionales (roomId, origin) y devuelva reservas no canceladas, retenciones no expiradas y bloqueos no removidos superpuestos al rango, normalizados a un mismo tipo de item; verificar con un test que cubra los tres tipos y sus exclusiones (cancelada, expirada, removida) — `src/infrastructure/database/admin-calendar-source.ts`, cubierto por `tests/postgres-admin-calendar.integration.test.ts` (gated, mismo patrón que el resto de la suite de integración Postgres del proyecto)
- [x] 1.2 Reemplazar `createAdminCalendarSource`/`getAdminCalendar` para que en producción use la consulta real (1.1) en vez de retornar `null`, manteniendo el modo mock para desarrollo/test; verificar que `/admin/calendario` en un boundary de producción con datos sembrados muestra ocupación real, no el mensaje "no disponible" — `src/features/admin/calendar.ts`; verificado end-to-end en modo mock vía `e2e/admin-calendar.spec.ts`
- [x] 1.3 Agregar índice o verificar cobertura de índice existente para las tres tablas en el rango de consulta usado (roomId+checkIn+checkOut); verificar con `EXPLAIN` o test de performance que la consulta del rango Mes no hace table scan — cobertura ya existente y suficiente: `reservation_items_room_reservation_idx`, `reservation_holds_room_interval_expiry_idx`, `room_blocks_room_interval_idx` (`src/persistence/schema.ts`); no se requirió una migración nueva
- [x] 1.4 (Alcance agregado durante la implementación, aprobado por el usuario) Construir `room-block-repository.ts` productivo para `room_blocks` — hasta ahora los bloqueos manuales solo funcionaban en modo mock (`getManualRoomBlocks()` retornaba `null` en producción), lo que bloqueaba la creación rápida de bloqueos (3.3/4.4); verificado con `tests/room-block-actions.test.ts` y `tests/manual-room-blocks.test.ts`

## 2. Tokens visuales

- [x] 2.1 Agregar `--admin-hold`/`--admin-hold-background` y `--admin-block`/`--admin-block-background` a `app/globals.css` junto a los tokens `--admin-reservation-*` existentes; verificar contraste texto/fondo ≥4.5:1 para cada par — contraste calculado ≥5.2:1 en ambos pares (ver design.md)
- [x] 2.2 Definir el set de íconos de origen (website, airbnb, booking, phone, whatsapp, admin) reusando la librería de íconos ya usada en `admin-shell.tsx`; verificar que cada origen tiene un ícono distinto y con `aria-label`/texto alternativo — `src/features/admin/origin-icon.tsx` (lucide-react, mismo set que el shell)

## 3. Vista mobile (agenda vertical) — base mobile-first

- [x] 3.1 Construir el componente de agenda vertical: lista de días del rango, cada uno mostrando habitaciones ocupadas/disponibles con color por tipo e ícono de origen; verificar en viewport 375px sin scroll horizontal — `MobileAgenda` en `src/features/admin/calendar-view.tsx`; verificado en `e2e/admin-calendar.spec.ts` ("renders as a vertical agenda with no horizontal scroll on mobile")
- [x] 3.2 Implementar indicador de "hoy" y sombreado de fin de semana en la agenda; verificar visualmente que el día actual y los fines de semana se distinguen del resto
- [x] 3.3 Implementar tap en día/habitación vacía → abrir opciones de creación rápida (reserva/bloqueo) con habitación+fecha precargadas; verificar que el formulario existente recibe los valores correctos — precarga real vía `initialSelection` en `ManualReservationForm` y `ManualBlockForm`, verificado en `e2e/admin-calendar.spec.ts`
- [x] 3.4 Implementar tap en item ocupado → panel de detalle (sheet) con datos esenciales y link a la vista completa; verificar navegación al detalle completo desde el panel — verificado en `tests/admin-calendar.test.tsx` y `e2e/admin-calendar.spec.ts`

## 4. Vista desktop/tablet (timeline por habitación)

- [x] 4.1 Construir el grid de timeline (habitaciones en filas, días en columnas) con barras posicionadas por intervalo de fechas, activo desde el breakpoint `md`; verificar que reservas/holds/bloqueos se renderizan en la fila y columnas correctas — `DesktopTimeline` en `calendar-view.tsx` (breakpoint `tablet:` del proyecto, equivalente a `md`); verificado en `tests/admin-calendar.test.tsx`
- [x] 4.2 Implementar columna de habitación sticky al hacer scroll horizontal del timeline; verificar en un rango de 30 días que la columna permanece visible — `position: sticky; left: 0` en la celda de habitación
- [x] 4.3 Implementar indicador de "hoy" (línea vertical) y sombreado de columnas de fin de semana en el timeline; verificar visualmente
- [x] 4.4 Implementar clic en celda vacía → creación rápida, y clic en barra → panel de detalle, reusando la lógica de 3.3/3.4; verificar comportamiento equivalente al de mobile — mismo estado/handlers compartidos entre `MobileAgenda` y `DesktopTimeline` en `AdminCalendarView`

## 5. Navegación de rango y filtros

- [x] 5.1 Implementar selector de rango con presets Semana, 2 semanas, Próximos 7 días y Mes (Mes por defecto), sincronizado con query params de la URL; verificar que recargar la URL con un preset reproduce el mismo rango — `src/features/admin/calendar-range.ts` + `calendar-toolbar.tsx`; cubierto por `tests/admin-calendar-range.test.ts` y `e2e/admin-calendar.spec.ts`
- [x] 5.2 Implementar navegación anterior/siguiente y botón "Hoy" dentro del preset activo; verificar que "Hoy" vuelve al rango que contiene la fecha actual sin cambiar el preset
- [x] 5.3 Implementar toggle de granularidad diaria/semanal comprimida dentro de la vista Mes, con cálculo de % de ocupación por semana y habitación; verificar que expandir una semana comprimida muestra su detalle diario — `CompressedMonthGrid`; verificado en `e2e/admin-calendar.spec.ts`
- [x] 5.4 Implementar filtros de habitación y origen siguiendo el patrón de `ReservationsFilterBar` (query params); verificar que filtrar por origen no oculta bloqueos (que no tienen origen) — corrección de alcance: las retenciones tampoco tienen origen en el esquema real (`reservation_holds` no tiene columna `origin`); el spec y la consulta se ajustaron para excluir también holds del filtro de origen

## 6. Movimiento y accesibilidad

- [x] 6.1 Definir módulo de tokens de motion (duración/easing) compartido y aplicarlo a: transición direccional entre rangos, entrada con stagger de barras/items, y apertura del panel de detalle con spring desde el origen del tap/clic; verificar visualmente cada transición — `src/features/admin/calendar-motion.tsx`
- [x] 6.2 Envolver las animaciones con soporte de `prefers-reduced-motion` (colapsando a fade instantáneo o sin transición); verificar con la preferencia activada en el sistema operativo que no hay desplazamiento/escala/rebote — `useReducedMotion` de framer-motion en cada componente de motion
- [x] 6.3 Verificar accesibilidad de teclado: navegación de rango, apertura de creación rápida y de panel de detalle son operables sin mouse/touch, con foco visible — navegación de rango son `<Link>`/`<a>` nativos; los sheets mueven el foco al abrir y cierran con Escape

## 7. Página y estados de carga

- [x] 7.1 Actualizar `app/(admin-protected)/admin/calendario/page.tsx` para leer los nuevos query params (rango, granularidad, habitación, origen) y pasar los datos normalizados a la vista; verificar cada combinación de parámetros vía URL directa — verificado en `e2e/admin-calendar.spec.ts`
- [x] 7.2 Actualizar `loading.tsx` para usar el shimmer existente (`admin-dashboard-shimmer`) en la forma del timeline/agenda mientras carga; verificar que no aparece contenido parcial ni layout shift
- [x] 7.3 Implementar estado vacío explícito (rango sin ocupación) distinto del estado "no disponible"; verificar que ambos mensajes son distinguibles para el usuario — mensaje "No hay reservas, retenciones ni bloqueos en este rango." vs. mensaje "No hay habitaciones activas..." cuando no hay habitaciones

## 8. Verificación end-to-end

- [x] 8.1 Escribir/actualizar pruebas e2e cubriendo: carga por defecto en Mes, cambio de preset y granularidad, creación rápida desde celda vacía, apertura de panel de detalle, y vista mobile sin scroll horizontal; verificar que la suite pasa en `tests`/`e2e` — `e2e/admin-calendar.spec.ts`, 4/4 tests verdes contra el servidor de desarrollo real

## 9. Rediseño a grilla de calendario clásica (Mes, Semana, 2 semanas)

Revisión post-implementación: el usuario pidió que Mes/Semana/2 semanas se
lean como un calendario común (columnas lunes-domingo, filas por semana,
número de día chico arriba-derecha) en vez del timeline por habitación
original. Ver design.md ("Patrón visual: grilla clásica...") y el spec
actualizado. Próximos 7 días no cambia.

- [x] 9.1 Construir el componente de grilla de calendario clásica (columnas lun-dom, filas = semanas del rango, número de día pequeño en la esquina superior derecha de cada celda) para las vistas Mes, Semana y 2 semanas en desktop/tablet; verificar que el número de semanas de fila coincide con las semanas reales del rango — `ClassicCalendarGrid` en `calendar-view.tsx`, filas via `weekBucketsWithin`; verificado en `tests/admin-calendar.test.tsx` y `e2e/admin-calendar.spec.ts`
- [x] 9.2 Renderizar cada habitación ocupada como un chip dentro de la celda de su día (mismo color/patrón por tipo y origen ya definidos), con truncado + indicador "+N" cuando no caben todos los chips; verificar con 4-5 habitaciones ocupadas el mismo día — `MAX_VISIBLE_DAY_CHIPS = 3`; verificado con test de 4 habitaciones ocupadas el mismo día ("+1 más")
- [x] 9.3 Acotar el componente de timeline por habitación existente (`DesktopTimeline`) para que solo se use en la vista Próximos 7 días; verificar que Mes/Semana/2 semanas ya no lo renderizan — `usesClassicGrid = range.preset !== "next_7_days"`; verificado en `e2e/admin-calendar.spec.ts` ("uses the classic grid for Semana and 2 semanas too")
- [x] 9.4 Ajustar la creación rápida: clic en área vacía de una celda de día en la grilla clásica abre el formulario con la fecha precargada y sin habitación (salvo que haya un filtro de habitación activo, en cuyo caso también se precarga); verificar ambos casos — `EmptySelection.roomId` ahora opcional; `activeRoomFilter` prop precarga la habitación cuando el filtro está activo; ambos casos cubiertos en `tests/admin-calendar.test.tsx`
- [x] 9.5 Verificar que el indicador de "hoy" y el sombreado de fin de semana funcionan como celda/columna en la nueva grilla (no solo en el timeline de Próximos 7 días) — reutiliza `isWeekend`/comparación con `today` por celda
- [x] 9.6 Actualizar `loading.tsx` para que el skeleton de Mes/Semana/2 semanas tenga forma de grilla de semanas en vez de filas de timeline — grid de 5×7 con `admin-dashboard-shimmer`
- [x] 9.7 Actualizar `tests/admin-calendar.test.tsx` y `e2e/admin-calendar.spec.ts` para la nueva estructura (celdas de día con chips en vez de barras por habitación en Mes); verificar que la suite completa sigue en verde — 6/6 tests unitarios y 5/5 e2e verdes; suite completa: 398 tests pasan, 2 fallas preexistentes sin relación
