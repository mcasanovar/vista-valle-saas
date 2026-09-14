## Context

La reserva se guarda como una cabecera con fechas compartidas, ítems por habitación con precios congelados y pagos independientes. La administración ya serializa cambios de estado bloqueando las habitaciones de la reserva, pero no existe una operación de modificación de fechas ni una representación de saldo adicional. La disponibilidad usa intervalos `[check-in, check-out)` y las fechas de alojamiento son `date` bajo `America/Santiago`.

## Goals / Non-Goals

**Goals:**

- Implementar una mutación única y transaccional para cambiar las fechas de reservas propias/manuales confirmadas.
- Recalcular precios con la tarifa autoritativa vigente y el conteo de huéspedes persistido por ítem.
- Mantener pagos aprobados como historial inmutable y calcular saldos adicionales o sobrepagos.
- Exponer el resultado en el detalle administrativo, auditoría y notificaciones.

**Non-Goals:**

- Editar reservas importadas desde Airbnb o Booking.
- Modificar reservas canceladas, completadas o no presentadas.
- Ejecutar devoluciones, créditos automáticos o ajustes dentro de los canales externos.
- Permitir que el navegador altere disponibilidad, precios, pagos o autorización.

## Decisions

### 1. Una operación de dominio para la edición

La edición se ejecutará mediante un servicio de dominio separado de la página y la acción server-side. La acción validará sesión y entrada; el servicio cargará de nuevo la reserva dentro de una transacción, verificará origen/estado, bloqueará todas las habitaciones en orden estable, excluirá la propia reserva de la detección de conflictos, recalculará el precio y actualizará cabecera e ítems como una unidad.

Se elige este flujo sobre actualizar primero la interfaz y luego consultar disponibilidad porque una extensión puede competir con otra reserva en el mismo intervalo.

### 2. Recalcular con la tarifa vigente

El nuevo total se calculará con las nuevas noches, las tarifas actuales de cada habitación y el `guestCount` ya persistido en cada ítem. Los valores enviados por el cliente solo representan las nuevas fechas; nunca se aceptarán totales ni precios del formulario.

Esto sigue la decisión de negocio acordada: una modificación vuelve a cotizar la estadía. La consecuencia es que una edición puede cambiar el precio por noche además de la cantidad de noches, y ese cambio quedará registrado en auditoría.

### 3. Pagos históricos y saldo pendiente consolidado

Los pagos aprobados nunca se actualizarán ni eliminarán. El servicio calculará `saldo = max(totalNuevo - sumaPagosAprobados, 0)`. Para una reserva sin pagos aprobados, actualizará el pago pendiente existente; si no existe, lo creará. Para una reserva pagada parcialmente o completamente, creará un nuevo pago pendiente por la diferencia positiva. Si ya existe un pago pendiente de una edición anterior, se ajustará ese saldo pendiente para evitar varios cobros duplicados por la misma deuda.

Los pagos pendientes conservarán referencias externas únicas y el detalle mostrará pagos aprobados, saldo pendiente y sobrepago por separado. Si `sumaPagosAprobados > totalNuevo`, no se mutará ningún pago y se conservará una alerta financiera/auditoría para resolución manual.

### 4. Elegibilidad defendida en servidor

La interfaz ocultará la edición para Airbnb y Booking, pero el servicio repetirá esa regla. La edición está disponible para una reserva de cualquier estado (`confirmed`, `cancelled`, `completed`, `no_show`) del momento en que su origen sea `website`, `phone`, `whatsapp` o `admin`; el estado de la reserva no cambia como efecto de la edición de fechas (una reserva cancelada permanece cancelada). No se aplicará la regla de fecha mínima del buscador público: una reserva activa puede conservar un `check-in` pasado mientras se extiende durante la estadía.

### 5. Integración operativa

La modificación emitirá una intención de notificación idempotente de reserva actualizada. El feed iCal saliente, cuando esté activo, reflejará las nuevas fechas porque se calcula desde las reservas actuales. Las reservas externas quedan fuera de la mutación, por lo que no se intentará escribir en Airbnb/Booking. Las tareas manuales existentes se conservarán y el panel mostrará el cambio en el calendario.

### 6. Auditoría y privacidad

Se agregará un evento de auditoría específico que guarde actor, origen, estado, fechas, noches, totales, pagos aprobados, saldo y sobrepago antes/después. No se copiarán datos personales del huésped ni secretos de proveedores en el evento.

## Risks / Trade-offs

- [La tarifa vigente puede diferir del precio original] → Mostrar el desglose anterior/nuevo y exigir confirmación explícita antes de aplicar.
- [Dos administradores pueden intentar extender la misma habitación] → Bloqueo estable por habitación y revalidación dentro de la transacción.
- [Una reducción puede dejar un sobrepago] → No devolver automáticamente; mostrar alerta y conservar resolución manual auditable.
- [Una edición puede cambiar una tarea operativa de canal] → Mantener la exclusión de reservas externas y reflejar la nueva ocupación en el feed/calendario propio.
- [Reintentos de la acción pueden crear cobros duplicados] → Idempotencia de la solicitud y consolidación de un único saldo pendiente abierto.

## Migration Plan

1. Añadir la mutación de dominio y sus dobles mock antes de activar la interfaz.
2. Añadir los campos o índices mínimos de persistencia para distinguir pagos pendientes de ajustes y ejecutar la migración de forma compatible con registros existentes.
3. Desplegar repositorio, acción, detalle, auditoría y notificación; mantener la edición oculta hasta que el servidor y la migración estén disponibles.
4. Verificar reservas propias, multi-habitación, pagadas, no pagadas, reducidas y conflictos antes de habilitar el control.
5. Para rollback, ocultar la acción y detener nuevas mutaciones; conservar los datos ya modificados y reconciliar manualmente saldos creados durante la ventana.
