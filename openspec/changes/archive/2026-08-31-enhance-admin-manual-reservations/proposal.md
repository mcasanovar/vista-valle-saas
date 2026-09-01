## Why

Las reservas pueden originarse fuera del sitio —por teléfono, WhatsApp o canales externos— y el formulario manual actual sólo admite una habitación y una parte de los datos de la reserva pública. El administrador necesita registrar estas reservas con la misma calidad de datos, validaciones, disponibilidad y experiencia visual del sistema.

## What Changes

- Se reemplaza el formulario básico de nueva reserva administrativa por un flujo de varias habitaciones que replica los datos de reserva pública: fechas, habitaciones, huésped, contacto, comentario y solicitud opcional de factura.
- Se conserva y explicita el origen administrativo de la reserva para canales externos, sin permitir que el administrador modifique precio, disponibilidad, capacidad, estado ni condición de pago.
- Todas las reservas manuales se crean exclusivamente como **pago al llegar**: reserva confirmada y pago pendiente, usando el mismo bloqueo transaccional y cálculo server-side que la reserva pública.
- El flujo funciona en los contextos autorizados mock y producción: en producción usa repositorios persistentes, bloqueo por todas las habitaciones, una transacción que incluye huésped, reserva, pago y outbox, y no admite una ruta administrativa sólo simulada.
- La interfaz reutiliza el lenguaje visual de la sección Reservas del dashboard: estructura, tipografía, tarjetas, tablas/selección y estados de error coherentes.
- Las acciones de carga usan spinner con etiqueta visible en botones y la carga de datos usa skeletons con shimmer; no se muestran valores parciales ni botones sin texto.

## Capabilities

### New Capabilities

- `admin-manual-reservations`: creación segura de reservas administrativas multi-habitación, con datos de huésped/factura, origen externo, pago al llegar y experiencia consistente del dashboard.

### Modified Capabilities

(ninguna)

## Impact

- `app/(admin-protected)/admin/reservas/nueva/page.tsx` y el formulario/acciones de reserva manual.
- Servicios de creación de reservas, validación, disponibilidad, persistencia y notificaciones existentes, sin introducir un camino de pago nuevo ni datos de prueba en producción.
- Componentes de presentación del dashboard y pruebas unitarias, integración y end-to-end de reservas manuales.
