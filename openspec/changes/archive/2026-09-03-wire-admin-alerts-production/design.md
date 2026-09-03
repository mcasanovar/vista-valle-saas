## Context

Ver `proposal.md` - Why. Tres fuentes alimentan `getOperationalAlerts()` (`src/features/admin/operational-alerts.ts`), y las tres están limitadas a `VISTA_VALLE_CONFIG_CONTEXT === "mock"`:

- `notification_failure`: hoy un ítem hardcodeado de demo. La tabla `notification_outbox` y su escritor de producción (`createDrizzleNotificationOutboxWriter`) ya existen, pero **no existe ningún procesador de producción** que llegue a marcar una fila como `failed` (`getScheduledOutboxProcessor()` devuelve `null` fuera de mock; no hay fuente de plantillas de producción). Un lector sería código correcto pero permanentemente silencioso en producción real. **Por eso queda fuera de este change** (ver Non-Goals) — se descubrió al empezar esa tarea, no en la exploración inicial.
- `payment_pending`: viene de `listMockReservationPaymentAdminViews` (`src/features/reservations/confirm-pay-at-property.ts`), 100% mock. Las tablas `reservations`/`payments` ya existen y sí se escriben en producción (`reservation-repository.ts` inserta `payments.status = "pending"` para toda reserva `pay_at_property`); falta la query de lectura.
- `channel_sync_conflict`: viene de `listChannelSyncConflictAlerts`/`recordChannelSyncConflictAlert` (`src/features/channel-calendar-sync/conflict-alerts.ts`), que solo escribe/lee un arreglo en `globalThis` bajo mock. No existe tabla.

El patrón de adaptador mock/producción ya está resuelto en el código para otra pantalla admin: `src/features/admin/calendar.ts` + `src/infrastructure/database/admin-calendar-source.ts` (`queryAdminCalendar(db, filter)`, recibiendo un `ProductionDatabase` de `createProductionDatabase`/`createDatabaseBoundary`). Este change reutiliza exactamente ese patrón, no inventa uno nuevo.

## Goals / Non-Goals

**Goals:**
- Que `channel_sync_conflict` y `payment_pending` funcionen bajo contexto de producción en `getOperationalAlerts()`, con el mismo tipo `OperationalAlert` que ya consume la UI.
- Persistir el único tipo de alerta que es un evento sin fila que lo respalde (`channel_sync_conflict`) en una tabla nueva.
- Seguir el patrón de adaptador ya validado en `admin-calendar-source.ts`.

**Non-Goals:**
- No se cambia `/admin/alertas/page.tsx` ni `admin-dashboard-view.tsx` — ambos ya consumen `OperationalAlert[]`/`openAlerts` sin cambios de forma.
- **`notification_failure` no se conecta a producción en este change** (decisión tomada durante la implementación, no en la exploración inicial): requiere un procesador de outbox de producción que no existe hoy — trabajo real, no una query adicional. Bajo mock sigue disponible, ahora leyendo del repositorio mock de outbox en vez de un ítem hardcodeado.
- No se agrega estado de alerta (resuelta/atendida/severidad) — eso quedó fuera del corte de esta exploración, para una iteración posterior.
- No se resuelve el mismo hueco mock-only en `admin/dashboard.ts` (KPIs de ocupación/reservas activas) ni en `admin/reservations.ts` (fuente de reservas recientes) — comparten el problema pero no son parte de este change.

## Decisions

### 1. Tabla `operational_alerts` genérica, con columna `kind`

Se agrega una tabla nueva en `src/persistence/schema.ts`:

```
operational_alerts
  id            uuid PK
  kind          operational_alert_kind enum ("channel_sync_conflict", ...)
  room_id       uuid FK -> rooms, nullable
  reservation_id uuid FK -> reservations, nullable
  message       text not null
  created_at    timestamptz
```

Solo `channel_sync_conflict` inserta filas hoy. `notification_failure` y `payment_pending` siguen siendo lecturas derivadas de `notification_outbox` y `reservations`/`payments` respectivamente — nunca se insertan en esta tabla, porque ya existe una fila de la que derivarlas.

**Alternativa considerada:** una tabla específica `channel_sync_conflict_alerts` es más angosta y sería lo mínimo estrictamente necesario hoy. Se prefirió la forma genérica porque el `design.md` del change `automate-channel-calendar-sync` (archivado) ya dejó anotado un caso futuro concreto de la misma naturaleza (alerta si un feed OTA lleva horas sin poder sondearse) como riesgo diferido, no como especulación sin origen — el discriminador `kind` evita una segunda migración cuando ese trabajo se confirme.

### 2. Adaptador de conflictos de channel-sync: mismo contrato, dos implementaciones

`conflict-alerts.ts` mantiene sus dos funciones exportadas (`recordChannelSyncConflictAlert`, `listChannelSyncConflictAlerts`) como el contrato que ya usan `ingest.ts` y `hold-expiry-alert.ts`. Internamente, se resuelve la implementación (mock en `globalThis` vs. Drizzle sobre `operational_alerts`) según el boundary de `createDatabaseBoundary()`, igual que `getAdminCalendar` en `admin/calendar.ts`. Implementado: ambas funciones pasaron de síncronas a `async` (una escritura real a Postgres no puede ser síncrona), lo que tocó sus 2 call sites y 3 tests existentes.

### 3. Lector de producción para `payment_pending`: query nueva, sin tabla nueva

Una función nueva en `src/infrastructure/database/`, siguiendo la forma de `queryAdminCalendar`: `queryPendingPayAtPropertyPayments(db)`, que lee `reservations` join `payments` donde `payment_mode = 'pay_at_property'` y `payments.status = 'pending'`.

(`notification_failure` habría seguido el mismo patrón — `queryFailedNotifications(db)` sobre `notification_outbox` — pero queda fuera de este change; ver Non-Goals.)

### 4. `getOperationalAlerts` deja de ser mock-only, para dos de sus tres fuentes

`operational-alerts.ts` pasa a ramificar por contexto (como `admin/calendar.ts`), combinando `channel_sync_conflict` y `payment_pending` en producción, en vez de retornar `null` fuera de mock. `notification_failure` no contribuye ítems bajo producción (ver Non-Goals) — el KPI "Alertas abiertas" en producción cuenta solo estas dos fuentes hasta que exista el procesador de outbox. El ítem hardcodeado `"notification-failure-demo"` se retira: bajo mock, `notification_failure` pasa a leer del repositorio mock de outbox existente (`getMockNotificationOutboxRepository`), igual que hace `notification-delivery-status.ts` hoy — este cambio no depende del procesador de producción diferido.

## Risks / Trade-offs

- [Una alerta de conflicto detectada justo antes de un reinicio del proceso podría perderse bajo el emisor actual en memoria] → Mitigado directamente por este change: la escritura en producción pasa a la tabla `operational_alerts`, no a `globalThis`.
- [La tabla genérica `operational_alerts` podría quedar con una sola fila de `kind` en uso por mucho tiempo si la alarma de feed OTA nunca se prioriza] → Aceptado: el costo de la columna `kind` de más es mínimo comparado con una migración futura; no bloquea nada de este change.
- [Migración de schema en una tabla nueva sobre una base de producción con datos reales] → Mismo procedimiento ya usado por las migraciones anteriores del proyecto (`db:generate`/`db:check`); no requiere backfill porque no hay datos previos que migrar a esta tabla.
- [El KPI "Alertas abiertas" en producción, tras este change, cuenta solo 2 de las 3 fuentes que cuenta bajo mock — un admin podría interpretarlo como el total real] → Aceptado como resultado consciente del alcance reducido: sigue siendo estrictamente más informativo que el `null` actual. Queda registrado en `admin-dashboard-shell` (spec delta, escenario "Alertas abiertas en producción") que la cobertura es parcial hasta que exista el procesador de outbox de producción.
