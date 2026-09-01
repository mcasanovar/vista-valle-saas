## Why

Hoy el bloqueo de fechas entre el sitio web y Airbnb/Booking depende enteramente de que un administrador complete manualmente el checklist de `/admin/sincronizaciones` después de cada reserva web, y de que él mismo revise Airbnb/Booking para detectar reservas externas. Esa ventana manual es la causa documentada del riesgo de sobreventa entre canales. Ambas OTAs soportan de forma nativa y gratuita la importación/exportación de calendarios iCal por alojamiento, lo que permite automatizar la mayor parte de ese bloqueo sin depender de un acceso API de partner (difícil de obtener para un alojamiento de este tamaño) ni de scraping (viola los términos de servicio y arriesga la cuenta del anfitrión).

## What Changes

- Ingesta periódica (poll, cadencia propia) del feed iCal de Airbnb: cada evento nuevo se materializa como una reserva real y completa (`origin: airbnb`, huésped placeholder fijo, pago ya `approved` porque Airbnb cobra directamente), usando el mismo pipeline transaccional de bloqueo de habitaciones (`RoomLockGateway.runExclusiveMany`) que cualquier otra reserva del sistema — no un bloqueo administrativo aparte.
- Publicación de un feed iCal saliente por habitación y canal (URL con token no adivinable) que la OTA importa para bloquear automáticamente las fechas ocupadas por reservas de otros orígenes (web, teléfono, WhatsApp, administración, la otra OTA).
- Un identificador externo estable (`externalRef`, tomado del `UID` del evento iCal) evita reprocesar el mismo evento en cada sondeo y permite reconocer su desaparición del feed como cancelación.
- Cancelación detectada por desaparición del `UID` en el feed entrante: se resuelve reutilizando la misma transición de estado que una cancelación administrativa manual, dejando el pago (ya aprobado) intacto.
- Detección de conflictos irreconciliables entre una reserva web y una externa, en los dos puntos donde pueden producirse pese al locking existente: (a) al momento de la ingesta, cuando el evento entrante choca con una reserva u hold de pago vigente; (b) cuando un hold de pago online expira mientras la sincronización externa toma la habitación en el intervalo, y el webhook de confirmación llega después. En ambos casos no se inserta la reserva perdedora y se emite una alerta operativa para el administrador coordine con el huésped.
- El envío de correo de confirmación transaccional se omite específicamente para reservas creadas por sincronización (el huésped ya fue confirmado por la OTA).
- El mecanismo se modela de forma genérica por plataforma + habitación (credenciales/URLs de feed, mapeo de eventos, cadencia) en vez de código específico de Airbnb, de modo que activar Booking.com más adelante reutilice la misma tubería sin trabajo adicional de diseño.
- El checklist manual existente (`channel_sync_tasks` / `/admin/sincronizaciones`) se conserva como mecanismo operativo para plataformas aún no conectadas por iCal (Booking al inicio de este change) y como vía de reconciliación manual cuando se detecta un conflicto.

## Capabilities

### New Capabilities
- `channel-calendar-sync`: sincronización automática de calendarios de ocupación con canales externos (OTAs) vía iCal, entrante y saliente, por plataforma y habitación, con detección y alerta de conflictos irreconciliables. Diseñada para activarse primero con Airbnb y extenderse a Booking.com sin cambios de forma.

### Modified Capabilities
<!-- Ninguna: las capacidades existentes (reservation-administration, admin-dashboard-shell) aún no tienen en las specs principales los requisitos de sincronización manual/alertas — viven en el change build-vista-valle-booking-mvp, todavía sin archivar. Este change no depende de que ese archivado ocurra primero: se apoya en el código ya construido (origin, RoomLockGateway, notification outbox, alertas), no en sus specs. -->

## Impact

- **Código:** nuevo feature `src/features/channel-calendar-sync/` (parsing/generación iCal, ingesta, feed saliente, detección de conflictos); extensión de `src/features/reservations/` (nuevo tipo de pago "ya aprobado por canal", guest placeholder, `externalRef`, salto de notificación); extensión de `src/features/reservations/confirm-pay-now-reservation.ts` y `app/api/webhooks/fintoc/route.ts` (alerta en `HoldExpiredError`); nuevo Route Handler protegido por secreto (mismo patrón que `app/api/internal/outbox/process/route.ts`) para el poll entrante; nuevo Route Handler público con token por habitación para el feed saliente.
- **Datos:** nuevas tablas/campos para credenciales y URLs de conexión por canal+habitación, y para el `externalRef` de idempotencia (evaluar en `design.md` si vive en `reservations` o en una tabla de mapeo separada).
- **Infraestructura:** un cron externo adicional (mismo mecanismo que ya dispara `outbox/process`).
- **No afecta:** el flujo de checkout público, el modelo de precios, ni las reservas manuales existentes (Booking, teléfono, WhatsApp, admin) siguen su curso sin cambios.
