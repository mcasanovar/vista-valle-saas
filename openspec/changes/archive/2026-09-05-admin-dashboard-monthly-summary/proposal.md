## Why

Hoy la pantalla Resumen del admin (`/admin`) solo tiene datos en contexto mock: `createAdminDashboardSource` en `src/features/admin/dashboard.ts` devuelve `null` para cualquier contexto distinto de `"mock"`, así que en producción siempre muestra "el resumen operativo no está disponible". Es el último módulo operativo del admin que falta conectar a datos reales, y el negocio necesita ver de un vistazo, por mes: cuánto ganó, cuántas reservas tuvo por canal (web, Airbnb, Booking, WhatsApp, teléfono, admin), cuánto ocupó cada habitación y cuánto perdió en cancelaciones/no-shows.

## What Changes

- Reemplaza el `return null` de producción en el resumen del admin por una fuente de datos real, agregada en SQL y acotada al mes seleccionado (para controlar el consumo de recursos: nunca se escanea todo el historial, solo el rango del mes filtrado).
- Agrega un selector de mes en la pantalla Resumen que filtra todo el contenido operativo por el **mes de `checkIn`** de la reserva (el mes en que ocupa la habitación), independientemente de cuándo se creó la reserva o se recibió el pago. Alertas abiertas queda fuera del filtro (es estado actual, no histórico) y la tabla de reservas recientes se mantiene global, sin filtrar por mes.
- "Total ganado" del mes = suma de `payments.amountClp` con `status = approved` cuyas reservas asociadas tienen `checkIn` en el mes seleccionado.
- "Reservas del mes" cuenta las reservas con estado `confirmed` o `completed` (excluye `cancelled` y `no_show`); agrega dos contadores nuevos, separados: total de canceladas y total de no-show del mes.
- Nuevo desglose de reservas por canal (`origin`: website, airbnb, booking, phone, whatsapp, admin) que muestra monto ganado y cantidad de reservas de forma distinguible en una misma visualización.
- Nuevo cálculo de ocupación por habitación: cada habitación cuenta como ocupada las noches del mes cubiertas por reservas en estado `confirmed` o `completed` con pago `approved`, sobre el total de noches disponibles de esa habitación en el mes.
- Nuevo gráfico de ventas del mes, agregando el monto ganado (aprobado) por día de `checkIn`.
- El diseño visual extiende el lenguaje ya aprobado del panel admin (paleta, tipografía, tarjetas, skeletons descrito en `proposes/admin-dashboard-design-notes.md`), sin introducir un lenguaje visual nuevo ni dependencias de gráficos pesadas.

## Capabilities

### New Capabilities

_(ninguna — esta capacidad ya existe)_

### Modified Capabilities

- `admin-dashboard-shell`: la pantalla Resumen gana un filtro de mes anclado a `checkIn`, una fuente de datos real en producción, y contenido nuevo (ganado del mes, canceladas/no-show, reservas por canal, ocupación por habitación, gráfico de ventas diario), además de las tarjetas KPI y tabla de recientes ya especificadas.

## Impact

- `src/features/admin/dashboard.ts`: implementar la rama de producción (hoy inexistente) con agregación SQL acotada al mes.
- Nueva fuente de infraestructura en `src/infrastructure/database/` para las consultas agregadas (canal, ocupación por habitación, ventas diarias), siguiendo el patrón ya usado por `admin-reservation-source.ts` y `operational-alerts-source.ts`.
- `src/features/admin/admin-dashboard-view.tsx`: selector de mes y nuevas secciones visuales.
- `openspec/specs/admin-dashboard-shell/spec.md`: spec delta con los nuevos requisitos.
- Sin nuevas dependencias de librería de gráficos: se evalúa una implementación SVG propia, liviana y coherente con la paleta ya definida, dado el bajo volumen de datos de una sola propiedad.
