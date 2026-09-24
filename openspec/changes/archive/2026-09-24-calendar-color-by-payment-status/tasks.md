## 1. Datos: estado de pago en el calendario

- [x] 1.1 En `queryAdminCalendar` (`src/infrastructure/database/admin-calendar-source.ts`), agregar una consulta/join a `payments` por `reservations.id` y calcular `paid` (true si existe un pago con `status = 'approved'` para esa reserva) siguiendo la misma regla que `paymentStatusById` en `admin-reservation-source.ts`. Verificar con una reserva de prueba que tiene un pago `approved` y otra sin pagos.
- [x] 1.2 Agregar el campo `paid?: boolean` a `AdminCalendarItem` (solo para `kind === "reservation"`) en el mismo archivo, y poblarlo en el mapeo de `reservationRows`. Verificar que el tipo compila sin tocar `hold`/`block`.

## 2. Estilo del calendario

- [x] 2.1 Agregar los tokens CSS `--admin-reservation-paid`, `--admin-reservation-paid-background`, `--admin-reservation-unpaid`, `--admin-reservation-unpaid-background` en `app/globals.css`, junto al bloque `--admin-reservation-*` existente (paid = el verde actual `#2f8f5b` / `#e6f4ea`; unpaid = un amarillo nuevo). Verificar visualmente en el navegador con las devtools.
- [x] 2.2 En `calendarItemStyle` (`src/features/admin/calendar-item-style.ts`), para `kind === "reservation"` devolver el estilo `paid` o `unpaid` según `item.paid`, eliminando `reservationStatusStyle` y su dependencia de `item.status`. Verificar que `hold` y `block` no cambian.
- [x] 2.3 Actualizar `CalendarLegend` en `src/features/admin/calendar-view.tsx`: renombrar las entradas de reserva a "Pagada" y "No pagada" apuntando a los nuevos tokens; dejar retención y bloqueo sin cambios. Verificar visualmente que la leyenda coincide con los chips.

## 3. Verificación

- [x] 3.1 Abrir `/admin/calendario` en un mes con reservas pagadas y no pagadas y confirmar que los colores coinciden con lo esperado (verde/amarillo) en la grilla clásica, en "Próximos 7 días" y en la agenda mobile. Verificado en el navegador (contexto mock) para la grilla clásica y "Próximos 7 días" — ambas muestran verde/amarillo correctamente junto con retención y bloqueo sin cambios; la agenda mobile usa el mismo `calendarItemStyle` compartido, no se pudo forzar el viewport angosto en esta sesión de navegador para capturarla aparte.
- [x] 3.2 Confirmar que una reserva `cancelled` sigue sin aparecer en el calendario (comportamiento no modificado por este change). Confirmado por revisión de código: `ne(reservations.status, "cancelled")` en `queryAdminCalendar` no se tocó.
- [x] 3.3 Correr la suite de tests existente relacionada al calendario admin y confirmar que pasa (o actualizarla si fija expectativas de color/estado obsoletas). `npx vitest run tests/admin-calendar.test.tsx tests/admin-calendar-range.test.ts` → 13/13 tests pasan. `npm run typecheck` limpio.
