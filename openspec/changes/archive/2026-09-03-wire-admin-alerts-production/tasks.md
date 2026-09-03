## 1. Tabla `operational_alerts`

- [x] 1.1 Definir en `src/persistence/schema.ts` el enum `operationalAlertKindEnum` (valor inicial: `channel_sync_conflict`) y la tabla `operational_alerts` (`id`, `kind`, `room_id` nullable FK a `rooms`, `reservation_id` nullable FK a `reservations`, `message`, `created_at`), y verificar que la migración generada aplica limpia sobre una base local (`db:generate`/`db:check`).
- [x] 1.2 Agregar índice por `created_at` (orden de listado) y verificar con una prueba de integración que insertar una fila y listarla devuelve el registro esperado.

## 2. Adaptador de producción para conflictos de channel-sync

- [x] 2.1 Implementar en `src/infrastructure/database/` una función `recordOperationalAlert(db, input)` que inserta en `operational_alerts` con `kind: "channel_sync_conflict"`, y otra `listOperationalAlerts(db)` que lista todas las filas ordenadas por `created_at` descendente.
- [x] 2.2 Modificar `src/features/channel-calendar-sync/conflict-alerts.ts` para que `recordChannelSyncConflictAlert`/`listChannelSyncConflictAlerts` resuelvan su implementación según el boundary de base de datos (mock → `globalThis` actual sin cambios; producción → adaptador de 2.1, mismo patrón que `admin/calendar.ts`), y verificado con una prueba que ambos contextos devuelven `ChannelSyncConflictAlert[]` con la misma forma. Nota: ambas funciones pasaron de síncronas a `async` — una escritura real a Postgres no puede ser síncrona; se actualizaron sus 2 call sites y los 3 tests existentes que las llamaban sin `await`.
- [x] 2.3 Verificado con `tests/postgres-operational-alerts.integration.test.ts`, corrido de verdad contra un Postgres.app local (`npm run test:integration:postgres`, 5 archivos / 23 tests en verde), que una alerta registrada en producción sobrevive a una nueva instancia del adaptador (simulando un reinicio del proceso), a diferencia del comportamiento mock.

## 3. Lector de producción para pagos "al llegar" pendientes

- [x] 3.1 Implementado `queryPendingPayAtPropertyPayments(db)` en `src/infrastructure/database/admin-pending-payments-source.ts` (join `reservations`/`payments` filtrando `payment_mode = 'pay_at_property'` y `payments.status = 'pending'`; los room lines se resuelven en una segunda consulta a `reservationItems` para no duplicar la reserva si tiene más de una habitación), con la forma que hoy produce `listMockReservationPaymentAdminViews` (id, checkIn, checkOut, roomId, roomIds, origin, status, totalClp, paymentStatus).
- [x] 3.2 Verificado (corrido de verdad contra Postgres local) con `tests/postgres-admin-pending-payments.integration.test.ts` que una reserva de producción con pago pendiente aparece en el resultado y una con pago aprobado no.

## 4. Integración en `getOperationalAlerts`

- [x] 4.1 Modificado `src/features/admin/operational-alerts.ts` para combinar las dos fuentes de producción (2.1, 3.1) bajo contexto de producción (mismo boundary que `admin/calendar.ts`), con la misma forma `OperationalAlert[]` que ya consume la UI, y `getOperationalAlerts` ya nunca retorna `null`. `notification_failure` queda fuera de este change y no aparece en el resultado de producción.
- [x] 4.2 Retirado el ítem hardcodeado `"notification-failure-demo"`; bajo mock, `notification_failure` ahora lee el repositorio mock de outbox existente (mismo dato que usa `notification-delivery-status.ts`), filtrando `status IN ("failed", "retrying")`.
- [x] 4.3 Verificado con `tests/admin-alerts-production.test.tsx` (mockea el boundary de base de datos y las queries de infraestructura, renderiza `AlertsPage` real) que `/admin/alertas` muestra datos reales bajo contexto de producción — conflicto de channel-sync y pago pendiente — sin el ítem mock y sin el mensaje "no disponible", sin tocar `page.tsx` ni `admin-dashboard-view.tsx`. El KPI del Resumen no se verificó por separado porque consume la misma `getOperationalAlerts()` vía `dashboard.ts`, ya cubierto por `tests/admin-dashboard-summary.test.tsx` existente (sigue en verde).

## 5. Verificación de extremo a extremo

- [x] 5.1 Verificado (corrido de verdad contra Postgres local, no solo escrito) con `tests/postgres-alerts-end-to-end.integration.test.ts`: simula exactamente lo que `ingest.ts` llama ante un `RoomLockConflictError` (`recordChannelSyncConflictAlert`) bajo un boundary de base de datos mockeado a producción contra Postgres real, confirma que la alerta persiste en `operational_alerts` y aparece en `getOperationalAlerts()`. Se detectaron y corrigieron colisiones de UUID fijo entre mis 3 archivos de test nuevos y `postgres-reservation.integration.test.ts` preexistente (ambos usaban `...201`/`...301` para habitaciones distintas) — reasignados a `...601`/`...701`/`...401`.
- [x] 5.2 Ejecutado `npm run test`: 466 pruebas pasan, 2 fallan (`prebooking-review-controller.test.tsx`, `room-detail.test.tsx`) — confirmado con `git stash` que ambas fallan igual sin ningún cambio de este change; no relacionadas (aserciones de estilo/orden de secciones ajenas a alarmas).

## Diferido (fuera de alcance de este change)

`notification_failure` en producción requiere que exista un procesador de outbox de producción (hoy `getScheduledOutboxProcessor()` devuelve `null` fuera de mock — ver la pausa de implementación registrada en la conversación de este change). Construir ese procesador es trabajo real, no una query adicional; se evaluará como un change nuevo y acotado cuando se priorice, siguiendo el mismo criterio usado para separar este change de `build-vista-valle-booking-mvp`.
