## ADDED Requirements

### Requirement: Ajuste financiero por modificación de reserva

El sistema SHALL conservar los pagos históricos y recalcular el saldo de una reserva modificada usando el total nuevo y la suma de pagos aprobados. Cuando el total nuevo sea mayor, SHALL crear o actualizar un pago pendiente por la diferencia; cuando sea menor, SHALL conservar los pagos aprobados y registrar el sobrepago para resolución manual sin devolución automática.

#### Scenario: Reserva pendiente modificada

- **WHEN** una reserva sin pagos aprobados cambia sus fechas y el total nuevo difiere del importe pendiente
- **THEN** el sistema actualiza el importe pendiente al total recalculado sin alterar el historial de pagos

#### Scenario: Diferencia adicional después de un pago

- **WHEN** el total nuevo supera la suma de pagos aprobados
- **THEN** el sistema crea un saldo pendiente separado por la diferencia exacta y lo muestra en el detalle administrativo

#### Scenario: Sobrepago después de reducir la estadía

- **WHEN** el total nuevo es inferior a la suma de pagos aprobados
- **THEN** el sistema no modifica los pagos históricos ni crea un pago negativo, y muestra el sobrepago como pendiente de resolución manual

#### Scenario: Cálculo contra importes manipulados

- **WHEN** el navegador envía un total pagado, saldo o diferencia distinto al calculado por el servidor
- **THEN** el sistema ignora esos valores y utiliza los pagos persistidos y el total autoritativo de la modificación
