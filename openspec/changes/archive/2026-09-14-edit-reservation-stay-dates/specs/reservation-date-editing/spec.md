## Purpose

Permitir que el personal autorizado ajuste las fechas de una reserva elegible sin perder consistencia de disponibilidad, precios, pagos ni trazabilidad operativa.

## ADDED Requirements

### Requirement: Edición transaccional de fechas

El sistema SHALL permitir a un administrador autorizado modificar `check-in` y `check-out` de una reserva elegible, usando fechas de alojamiento bajo `America/Santiago`, y SHALL confirmar el cambio solo si el nuevo intervalo es válido y todas las habitaciones siguen disponibles.

#### Scenario: Extensión de una reserva de una habitación

- **WHEN** el administrador cambia el `check-out` de una reserva elegible a una fecha posterior
- **THEN** el sistema revalida el intervalo, bloquea la habitación durante la operación y actualiza las fechas de la reserva sin crear una segunda reserva

#### Scenario: Modificación de una reserva multi-habitación

- **WHEN** el administrador modifica las fechas de una reserva con varias habitaciones
- **THEN** el sistema aplica las mismas fechas a todos sus ítems y confirma todos los cambios o ninguno

#### Scenario: Conflicto en una de las habitaciones

- **WHEN** las nuevas fechas se superponen con una reserva, retención o bloqueo de cualquiera de las habitaciones, excluyendo la propia reserva editada
- **THEN** el sistema rechaza la modificación, conserva las fechas y disponibilidad anteriores y muestra el conflicto

#### Scenario: Intervalo inválido

- **WHEN** el administrador envía un `check-out` igual o anterior al `check-in`
- **THEN** el sistema rechaza la modificación y no cambia la reserva

### Requirement: Elegibilidad por origen

El sistema SHALL permitir la edición para reservas con origen `website`, `phone`, `whatsapp` o `admin`, en cualquier estado (`confirmed`, `cancelled`, `completed` o `no_show`), y SHALL rechazarla únicamente para reservas originadas en `airbnb` o `booking`. Editar las fechas SHALL NOT modificar el estado de la reserva: una reserva cancelada, completada o no presentada conserva ese estado después de la edición.

#### Scenario: Reserva de Airbnb o Booking

- **WHEN** el administrador intenta editar las fechas de una reserva originada en Airbnb o Booking
- **THEN** el sistema no muestra la acción de edición y el servidor rechaza cualquier solicitud manipulada

#### Scenario: Reserva cancelada, completada o no presentada

- **WHEN** el administrador edita las fechas de una reserva elegible por origen que está cancelada, completada o marcada como no presentada
- **THEN** el sistema aplica el mismo recálculo de fechas, precio y saldo, y la reserva conserva su estado original

### Requirement: Recálculo autoritativo del valor

El sistema SHALL recalcular noches, tarifa vigente, cargos y total agregado a partir de las nuevas fechas y los datos confiables de cada habitación, sin aceptar precios ni totales enviados por el navegador.

#### Scenario: Reserva no pagada

- **WHEN** se modifican las fechas de una reserva sin pagos aprobados
- **THEN** el sistema reemplaza el importe pendiente por el total recalculado de la nueva estadía

#### Scenario: Reserva con pago aprobado y saldo adicional

- **WHEN** el total recalculado es mayor que la suma de los pagos aprobados
- **THEN** el sistema conserva los pagos históricos y crea un nuevo pago pendiente por la diferencia

#### Scenario: Reserva reducida con pago aprobado

- **WHEN** el total recalculado es menor que la suma de los pagos aprobados
- **THEN** el sistema conserva los pagos históricos, deja constancia del sobrepago para resolución manual y no crea un cobro adicional

### Requirement: Auditoría y comunicación del cambio

El sistema SHALL registrar una auditoría del cambio con administrador, fechas anteriores y nuevas, totales anteriores y nuevos, importe pagado considerado, saldo pendiente y eventual sobrepago. El sistema SHALL actualizar el detalle administrativo y generar la comunicación transaccional configurada para informar la modificación.

#### Scenario: Modificación confirmada

- **WHEN** una modificación de fechas se confirma correctamente
- **THEN** el detalle muestra las nuevas fechas, noches, total, pagos, saldo y cualquier sobrepago, y la auditoría identifica al administrador y los valores modificados

#### Scenario: Modificación rechazada

- **WHEN** la modificación falla por autorización, elegibilidad, intervalo o disponibilidad
- **THEN** no se registra un cambio de fechas, precio o pago como exitoso ni se envía una confirmación de modificación
