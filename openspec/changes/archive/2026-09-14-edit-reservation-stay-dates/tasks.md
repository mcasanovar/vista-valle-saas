## 1. Contrato y reglas de dominio

- [x] 1.1 Definir el contrato de modificación de fechas, elegibilidad por origen y errores de intervalo; verificar con pruebas unitarias que se rechacen Airbnb y Booking (en cualquier estado), que se acepte cualquier otro origen sin importar su estado, y que se rechacen fechas inválidas.
- [x] 1.2 Implementar el recálculo multi-habitación desde fechas, huéspedes persistidos y tarifas vigentes; verificar noches, cargos, subtotales y total sin aceptar importes del cliente.
- [x] 1.3 Implementar la operación transaccional que bloquee todas las habitaciones en orden estable, excluya la propia reserva de conflictos y actualice cabecera e ítems como una unidad; verificar extensión, reducción y conflicto concurrente.
- [x] 1.4 Implementar el doble mock de la mutación y su actualización de ocupación; verificar que una operación rechazada no cambie fechas, precios ni disponibilidad.

## 2. Persistencia y pagos

- [x] 2.1 Extender los contratos de repositorio Drizzle/mock para leer y actualizar una reserva editable con sus ítems y pagos asociados; verificar composición con reservas de una y varias habitaciones.
- [x] 2.2 Implementar el cálculo financiero usando pagos aprobados persistidos, actualización del pendiente existente o creación de un nuevo saldo positivo, y detección de sobrepago; verificar reserva no pagada, parcialmente pagada, pagada extendida y reducida.
- [x] 2.3 Añadir la migración o índices necesarios para referencias únicas de saldos derivados de modificaciones y ejecutar la verificación offline del esquema.
- [x] 2.4 Registrar el evento de auditoría con fechas, noches, totales, pagos aprobados, saldo y sobrepago sin datos personales; verificar valores before/after y actor.

## 3. Administración y comunicación

- [x] 3.1 Añadir la acción server-side protegida y el formulario accesible de edición de `check-in`/`check-out`, con confirmación explícita y mensajes de conflicto; verificar autorización, validación server-side y teclado.
- [x] 3.2 Actualizar el detalle administrativo para mostrar la acción solo a reservas elegibles por origen y presentar fechas, noches, total, pagos, saldo pendiente y sobrepago; verificar que Airbnb/Booking no expongan controles y que estados no confirmados (cancelada, completada, no-show) sí los expongan.
- [x] 3.3 Añadir el evento de outbox y plantilla/contrato de notificación de reserva modificada con deduplicación; verificar que el fallo del proveedor no revierta la modificación.
- [x] 3.4 Actualizar calendario, listado y feed iCal para reflejar las nuevas fechas sin alterar reservas externas; verificar navegación al detalle y ocupación actualizada.

## 4. Verificación integral

- [x] 4.1 Añadir pruebas de integración PostgreSQL para la transacción multi-habitación, conflictos con reservas/bloqueos y rollback atómico; verificar que no queden cambios parciales.
- [x] 4.2 Añadir pruebas de integración de pagos y auditoría para saldo adicional, reducción con sobrepago y reintento idempotente; verificar que los pagos históricos permanezcan intactos.
- [x] 4.3 Añadir pruebas end-to-end del panel para extender una reserva no pagada, extender una reserva pagada y reducir una reserva; verificar fechas, importes, alertas y auditoría visible.
- [x] 4.4 Ejecutar las pruebas focalizadas, validación OpenSpec y comprobaciones de accesibilidad relevantes; registrar resultados y cualquier riesgo residual en el handoff.
