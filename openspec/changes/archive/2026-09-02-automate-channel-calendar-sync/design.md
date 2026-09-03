## Context

Ver `proposal.md` - Why. Este change se apoya en infraestructura ya construida por `build-vista-valle-booking-mvp` (aún sin archivar, y este change no depende de que se archive):

- `RoomLockGateway.runExclusiveMany` / `runExclusive` (`src/features/availability/room-lock.ts`): el único punto autorizado para crear ocupación (reserva, hold o bloqueo) de forma atómica, con relectura de superposición bajo lock.
- `ReservationOrigin` ya incluye `"airbnb"` y `"booking"` (`src/features/reservations/reservation-repository.ts:13-19`), y `createMultiRoomPayAtPropertyReservation` (`create-pay-at-property-reservation.ts`) ya acepta `origin` como parámetro — es la misma función que usa hoy el formulario manual de reserva.
- `notification_outbox`: `createMultiRoomPayAtPropertyReservation` solo escribe el evento de confirmación si se le pasa un `notificationOutboxWriter` (`create-pay-at-property-reservation.ts:161`); omitirlo es la manera natural de no notificar.
- El patrón de tarea programada protegida por secreto (`app/api/internal/outbox/process/route.ts`, disparado por un cron externo) es el mismo mecanismo a replicar para el sondeo entrante.
- `confirm-pay-now-reservation.ts` (`HoldExpiredError`) y `app/api/webhooks/fintoc/route.ts` son el punto exacto donde ocurre la carrera de vencimiento de retención descrita en la propuesta.
- `channel_sync_tasks` (`src/features/channel-sync/`) es el checklist manual actual; se mantiene vivo para plataformas sin conexión iCal y como mecanismo de reconciliación cuando hay alerta de conflicto — no se reemplaza en este change.

## Goals / Non-Goals

**Goals:**
- Automatizar el bloqueo de fechas entre canales sin requerir acceso API de partner de ninguna OTA.
- Reutilizar el pipeline transaccional de reservas existente en vez de introducir un concepto paralelo de "bloqueo externo".
- Que el mecanismo sea genérico por plataforma+habitación desde el primer commit, aunque la primera plataforma conectada sea solo Airbnb.
- Que ningún conflicto detectado silencie el problema: todo conflicto irreconciliable produce una alerta operativa explícita.

**Non-Goals:**
- Integrar la API oficial de Airbnb/Booking como partner certificado.
- Sincronizar datos del huésped (nombre, contacto) más allá de lo que el feed iCal expone (nada) — sigue siendo carga manual posterior.
- Automatizar la resolución de un conflicto detectado; el sistema alerta, el administrador decide.
- Sustituir `channel_sync_tasks` para plataformas sin conexión iCal activa.

## Decisions

### 1. Los eventos entrantes se materializan como reservas reales, no como bloqueos

Se descartó introducir una fuente de ocupación nueva (`"external_ical"` sobre `OccupancySource`) o una tabla paralela de "bloqueos externos". En su lugar, la ingesta llama a `createMultiRoomPayAtPropertyReservation` con `origin` igual a la plataforma del evento, exactamente como lo haría un administrador cargando la reserva a mano. Esto mantiene una sola fuente de verdad para "qué reservas existen" (calendario, listado, detalle, reportes futuros funcionan sin caso especial) en vez de dos conceptos (reservas y bloqueos externos) que representarían lo mismo.

**Alternativa considerada:** tratar los eventos entrantes como `room_blocks` (como los bloqueos administrativos) es más simple de construir, pero deja el calendario admin sin poder mostrar "esta fecha está ocupada por una reserva de Airbnb" de forma consistente con el resto del sistema, y obliga a admins a recordar que un bloqueo puede en realidad ser una reserva pagada.

### 2. Comportamiento de pago configurado por conexión de canal, no inferido del origen

Airbnb cobra directamente al huésped; Booking no. Por lo tanto el "pago ya aprobado" no es una propiedad de "vino por sincronización" sino de la conexión de canal específica. Cada conexión (`platform` + `roomId`) declara su comportamiento de pago (`auto_approved` o `pay_at_property`), y la ingesta lo consulta antes de crear el pago asociado. Esto evita que activar Booking más adelante requiera una rama de código nueva: solo una fila de configuración con comportamiento distinto.

### 3. Idempotencia vía campo `externalRef` en la reserva, no tabla de mapeo separada

Se añade `externalRef` (identificador del evento de origen) y `externalPlatform` a `reservations`, con unicidad sobre `(externalPlatform, externalRef)`. Se descartó una tabla de mapeo aparte: la relación es 1:1 y de solo lectura para el propósito de idempotencia; una tabla adicional solo añadiría un join sin beneficio, dado que ninguna otra entidad necesita apuntar al evento externo.

### 4. Huésped placeholder fijo, sin relajar el esquema

`guests.email` es `NOT NULL` sin `UNIQUE` (`src/persistence/schema.ts:161-171`). En vez de migrar el esquema para permitir un huésped sin contacto real, la ingesta crea un huésped con `firstName: "Huesped"`, `lastName: "Airbnb"` (o el nombre de la plataforma correspondiente), un teléfono generado válido para el formato esperado, y `email: "vistavallespa@gmail.com"` como valor institucional compartido. No hay conflicto de unicidad porque no existe restricción `UNIQUE` sobre `email`.

**Alternativa considerada:** migrar `email` a nullable evita el valor compartido, pero introduce un caso especial que el resto del sistema (validaciones, envíos, reportes) tendría que empezar a contemplar en todas partes. El placeholder fijo confina el caso especial a un solo punto de creación.

### 5. Conflictos se detectan, nunca se resuelven automáticamente

Dos puntos de detección, mismo tratamiento:

- **En la ingesta:** el intento de crear la reserva desde el evento entrante pasa por `runExclusiveMany` igual que cualquier otra; si lanza `RoomLockConflictError`, la ingesta captura ese error específico, no propaga la creación, y emite la alerta en vez de reintentar o forzar.
- **En el webhook de pago:** cuando `confirm-pay-now-reservation.ts` lanza `HoldExpiredError`, `app/api/webhooks/fintoc/route.ts` hoy solo lo manda a Sentry (captura genérica). Este change añade, específicamente para ese error, la misma alerta operativa — sin cambiar el resto del manejo de errores del webhook.

Ambos casos usan el mismo emisor de alerta y el mismo mensaje orientado al admin ("reserva sobreduplicada... coordine con huésped"), tratados como una sola categoría de alerta en `/admin/alertas`, no dos.

**Alternativa considerada:** intentar resolver automáticamente (p. ej. cancelar la reserva más nueva) es inviable para el caso Airbnb-primero (no se puede cancelar por temas legales/reembolso, según lo acordado) y arriesgado para el caso web-primero (podría cancelar una reserva que el huésped web ya considera confirmada). Alertar y dejar la decisión al administrador es la única opción segura en ambos sentidos.

### 6. Feed saliente calculado al vuelo, sin caché

El Route Handler que sirve el `.ics` de salida consulta la ocupación vigente en el momento de la solicitud (misma fuente que ya alimenta disponibilidad) y genera el documento iCal directamente, filtrando por `origin` distinto a la plataforma solicitante. No se persiste el `.ics` generado: con tres habitaciones el costo de generarlo por solicitud es trivial, y evita in­consistencias entre una caché y el estado real.

### 7. Mock-first, igual que el resto del sistema

Bajo `VISTA_VALLE_CONFIG_CONTEXT=mock` (decisión 13 del MVP), el sondeo entrante no abre conexión de red real: usa fixtures deterministas de eventos iCal. El feed saliente en mock se genera igual desde los datos mock existentes, sin lógica condicional adicional más allá de la que ya aplica a cualquier lectura de ocupación.

### 8. La pantalla de conexiones vive como pestaña dentro de Sincronizaciones, no como ítem de navegación nuevo

`/admin/sincronizaciones` gana una segunda pestaña, **"Conexiones de canal"**, junto a la pestaña existente **"Cola manual"** (el `ChannelSyncChecklist` actual, sin cambios). Se descartó agregar un ítem nuevo al grupo SISTEMA del shell admin (`admin-shell.tsx:45-54`): con solo 3 habitaciones y 2 plataformas, ambas vistas describen la misma responsabilidad — "cómo se mantiene sincronizado un canal externo" — desde dos ángulos (config automática vs. seguimiento manual), y conviene que se expliquen mutuamente en la misma pantalla en vez de fragmentar la navegación.

Esto implica una regla de comportamiento nueva: `channel_sync_tasks` (`src/features/channel-sync/tasks.ts`) **deja de crear** una tarea manual para una combinación plataforma+habitación cuya conexión de canal esté `Activa` — esa plataforma ya se sincroniza sola. La cola manual sigue existiendo tal cual para toda combinación sin conexión activa (Booking, al inicio; o Airbnb en una habitación aún sin configurar).

**Alternativa considerada:** un ítem de navegación separado ("Canales") es más descubrible a primera vista, pero separa dos vistas que un admin necesita comparar constantemente para entender por qué una plataforma ya no aparece en la cola manual.

## Risks / Trade-offs

- [Airbnb puede tardar horas en leer el feed saliente; no controlamos esa cadencia] → El checklist manual (`channel_sync_tasks`) permanece activo como red de seguridad durante esa ventana; evaluar en una iteración posterior una alerta si una reserva web sigue sin reflejarse en el feed entrante de Airbnb después de un umbral de horas.
- [El formato del iCal de una OTA puede cambiar sin aviso y romper el parseo] → El sondeo debe tratar un fallo de parseo como error operativo (alerta/log), nunca como "sin eventos"; un feed vacío por error no debe interpretarse como cancelaciones masivas.
- [El huésped placeholder comparte un correo institucional entre muchas reservas] → Documentar que contactar al huésped real de una reserva Airbnb/Booking sincronizada se hace por la plataforma de origen, no por el correo del sistema, hasta que el admin cargue el contacto real.
- [Un cron externo que deja de dispararse detiene el sondeo silenciosamente] → Mismo riesgo ya aceptado para `outbox/process`; se beneficia de la misma observabilidad que se implemente para ese endpoint.

## Migration Plan

1. Construir el modelo de conexión de canal (plataforma + habitación + comportamiento de pago + credenciales/tokens) y el feed saliente primero, activable solo para Airbnb, sin ingesta entrante todavía — riesgo bajo, no crea datos, ya reduce sobreventa hacia Airbnb.
2. Habilitar la ingesta entrante de Airbnb con las alertas de conflicto activas desde el primer día (no como mejora posterior).
3. Validar en `mock` con fixtures de eventos (creación, evento repetido, evento retirado, evento superpuesto) antes de habilitar cualquier feed real en producción.
4. Activar Booking.com agregando una segunda conexión de canal con comportamiento de pago `pay_at_property`, sin tocar el mecanismo de ingesta/publicación.

## Open Questions

- ¿Conviene exponer en el panel un indicador de "última sincronización exitosa" por conexión, para detectar un feed que dejó de responder antes de que se acumulen días de desfase? No cambia el enfoque ni las specs; se puede resolver en una iteración de UI posterior.
- ¿El motivo de cancelación por sincronización ("cancelado por Airbnb") requiere un campo de texto libre nuevo en el evento de auditoría, o basta con registrar el actor como `sync:airbnb`? No afecta el comportamiento observable descrito en las specs; se resuelve al definir el esquema de auditoría en tasks.md.
