## Why

El historial comercial de Vista Valle de 2024, 2025 y 2026 vive en una planilla Excel (`scripts/vista-valle-historial.xlsx`, pestaña `homologado`) con 696 reservas, mientras la base de datos solo contiene reservas de prueba creadas durante el desarrollo del MVP. Sin ese historial, el panel administrativo no puede mostrar ingresos reales, comparar temporadas ni servir de fuente única de verdad, y las 4 reservas vigentes de septiembre 2026 que aún están solo en la planilla corren riesgo de sobreventa.

## What Changes

- Nuevo script de operación única `scripts/import-historical-reservations.mjs` que lee la pestaña `homologado` del Excel, homologa sus campos al modelo del sistema y los persiste.
- El script incluye un lector `.xlsx` propio (descompresión ZIP + parseo XML de OOXML) para no incorporar una dependencia nueva por una operación que se ejecuta una sola vez.
- **BREAKING**: antes de insertar, el script elimina de forma irreversible todas las reservas, ítems, pagos, eventos de pago, huéspedes, retenciones, bloqueos de habitación, tareas de sincronización de canal, alertas operacionales, notificaciones, interacciones del asistente, eventos de auditoría y cotizaciones de empresa existentes. Se conservan habitaciones, imágenes, amenidades y conexiones de canal.
- Reglas de homologación de piezas, plataformas y estados de pago hacia los enums existentes (`reservation_status`, `reservation_origin`, `payment_status`).
- Reglas de saneamiento de datos corruptos de la planilla: años fuera de rango, fechas invertidas, noches descuadradas y valores por noche en cero.
- Inserción de filas en `payments` con estado `approved` para cada reserva pagada, de modo que los ingresos históricos aparezcan en el resumen del panel administrativo, que agrega por pagos aprobados y no por el total de la reserva.
- Modo `--dry-run` por defecto con reporte de conteos y filas rechazadas; escritura real solo con `--commit`, en una única transacción que envuelve limpieza e inserción.
- Identificador público determinista por fila para que una segunda ejecución no duplique reservas.

## Capabilities

### New Capabilities

- `historical-reservation-import`: importación única y trazable del historial de reservas desde la planilla Excel hacia la base de datos, incluyendo la limpieza previa de datos de prueba, las reglas de homologación de campos, el saneamiento de filas defectuosas y la generación de los pagos que alimentan los reportes del panel administrativo.

### Modified Capabilities

Ninguna. El import escribe sobre el esquema existente mediante SQL directo y no altera el comportamiento especificado de la reserva pública, la reserva administrativa, la disponibilidad ni el panel; solo cambia el contenido de la base.

## Impact

- **Nuevo código**: `scripts/import-historical-reservations.mjs` y su lector de `.xlsx`. Sigue el patrón de `scripts/load-room-content.mjs`: `postgres` directo, `DATABASE_URL` desde el entorno, sin importar código de la aplicación.
- **Datos de entrada**: `scripts/vista-valle-historial.xlsx`, pestaña `homologado`, bloques `C8:O225` (2024), `Q8:AC281` (2025) y `C228:O435` (2026).
- **Tablas escritas**: `guests`, `reservations`, `reservation_items`, `payments`.
- **Tablas vaciadas**: `payment_events`, `payments`, `reservation_items`, `channel_sync_tasks`, `notification_outbox`, `operational_alerts`, `reservations`, `reservation_holds`, `guests`, `room_blocks`, `assistant_interactions`, `audit_events`, `company_quotation_lines`, `company_quotations`.
- **Tablas preservadas**: `rooms`, `room_images`, `amenities`, `room_amenities`, `channel_connections`, `company_quotation_breakfast_catalog`.
- **Consumidores afectados**: el resumen del panel (`admin-dashboard-summary-source.ts`), el calendario administrativo (`admin-calendar-source.ts`) y la disponibilidad pública (`room-lock.ts`) pasan a operar sobre datos reales.
- **Dependencias**: ninguna nueva.
- **Riesgo principal**: la limpieza es irreversible y se ejecuta sin respaldo previo por decisión explícita del dueño del producto, dado que todo el contenido actual es de prueba.
