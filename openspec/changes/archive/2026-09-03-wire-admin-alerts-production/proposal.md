## Why

El panel admin ya declara y muestra el KPI "Alertas abiertas" y la pantalla `/admin/alertas`, pero toda la cadena de datos que las alimenta (`getOperationalAlerts`, `notification-delivery-status.ts`, y el emisor de conflictos de channel-sync) solo funciona bajo `VISTA_VALLE_CONFIG_CONTEXT === "mock"`. Fuera de mock devuelven `null`/vacío o, en el caso de los conflictos de channel-sync, descartan el evento en silencio porque su único almacenamiento es un arreglo en `globalThis`. Antes de habilitar reservas directas en producción (tarea 10 de `build-vista-valle-booking-mvp`), el administrador necesita ver alertas reales, no un hueco vacío.

## What Changes

- Agregar la tabla `operational_alerts` (genérica, con columna `kind`) al schema Drizzle, para alarmas que son eventos sin fila que las respalde en otra tabla. Hoy solo `channel_sync_conflict` la usa; el discriminador `kind` evita una migración nueva cuando aparezca la próxima alarma-evento (ej. feed de una OTA sin refrescar, ya anotada como riesgo diferido en el change de channel-sync).
- Reemplazar el emisor en memoria de conflictos de channel-sync (`src/features/channel-calendar-sync/conflict-alerts.ts`) por un adaptador que persiste en `operational_alerts` bajo contexto de producción, siguiendo el mismo patrón mock/producción que ya usa `admin-calendar-source.ts`.
- Agregar una consulta de producción para `payment_pending`, derivada de `reservations`/`payments` (pago al llegar pendiente), y usarla desde `operational-alerts.ts` en vez de `listMockReservationPaymentAdminViews`.
- Actualizar `getOperationalAlerts` (`src/features/admin/operational-alerts.ts`) para combinar las dos fuentes anteriores bajo ambos contextos, no solo mock.

**Fuera de alcance (reducido durante la implementación):** `notification_failure` no se conecta a producción en este change. Al empezar esa tarea se encontró que el procesador de outbox de producción no existe (`getScheduledOutboxProcessor()` devuelve `null` fuera de mock) — ninguna fila de `notification_outbox` llega nunca a `failed` en producción hoy, así que un lector ahí sería código correcto pero permanentemente silencioso. Construir ese procesador es trabajo real (fuente de plantillas de producción + activar el procesador), no una query adicional, y queda para un change futuro y acotado. Bajo mock, `notification_failure` deja de ser un ítem hardcodeado y pasa a leer el repositorio mock de outbox existente.

Ninguno de estos cambios modifica la UI de `/admin/alertas` ni el KPI del dashboard: ambos ya leen `OperationalAlert[]`/`openAlerts` sin cambios de forma; lo que cambia es de dónde sale ese dato fuera de mock.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `admin-dashboard-shell`: el KPI "alertas abiertas" del Resumen y la pantalla Alertas deben reflejar datos reales bajo contexto de producción, no solo mock.
- `channel-calendar-sync`: las alertas de conflicto (ingesta y vencimiento de retención) deben persistir y quedar visibles para el administrador bajo contexto de producción, no solo mock.

## Impact

- **Schema:** nueva tabla `operational_alerts` en `src/persistence/schema.ts` (+ migración).
- **Código:** `src/features/channel-calendar-sync/conflict-alerts.ts` (adaptador producción), `src/infrastructure/database/` (nuevas queries: alertas de conflicto, pagos pendientes — mismo patrón que `admin-calendar-source.ts`), `src/features/admin/operational-alerts.ts`.
- **Sin tocar (a diferencia de lo planeado inicialmente):** `src/features/admin/notification-delivery-status.ts` — `notification_failure` queda diferido, ver nota de alcance arriba.
- **Sin cambios:** `app/(admin-protected)/admin/alertas/page.tsx`, `admin-dashboard-view.tsx`, y los tipos `OperationalAlert`/`AdminDashboardKpis` existentes.
