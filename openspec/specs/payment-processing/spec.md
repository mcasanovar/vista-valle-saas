# payment-processing Specification

## Purpose

TBD - Update Purpose after archive. (A fuller draft of this capability's Purpose exists in the delta at `openspec/changes/build-vista-valle-booking-mvp/specs/payment-processing/spec.md`, which has not yet been synced.)

## Requirements

### Requirement: Selección de modalidad de pago al confirmar reserva
El sistema SHALL permitir al huésped elegir entre pago al llegar y pago en línea al confirmar una reserva, y SHALL registrar la modalidad elegida (`pay_at_property` o `pay_now`) junto con el proveedor de pago usado cuando la modalidad sea pago en línea.

#### Scenario: Huésped elige pago en línea
- **WHEN** el huésped confirma una reserva y selecciona pago en línea
- **THEN** el sistema registra la reserva con modalidad `pay_now` y proveedor Fintoc, y no la marca como pagada hasta recibir confirmación del proveedor

#### Scenario: Huésped elige pago al llegar
- **WHEN** el huésped confirma una reserva y selecciona pago al llegar
- **THEN** el sistema registra la reserva con modalidad `pay_at_property` sin iniciar ningún flujo de pago en línea, igual que en el comportamiento existente

### Requirement: Estado transicional de pago en línea
El sistema SHALL soportar un estado de pago transicional ("requiere acción") para pagos en línea que aún no llegaron a un estado final, además de los estados existentes (pendiente, aprobado, rechazado, cancelado, reembolsado), y SHALL impedir que una reserva se marque como confirmada-pagada mientras el pago esté en ese estado transicional.

#### Scenario: Pago en línea pendiente de una acción adicional
- **WHEN** el proveedor de pago informa que el pago requiere una acción adicional del huésped o de un tercero antes de completarse
- **THEN** el sistema mantiene el pago en estado transicional y la reserva no se considera pagada hasta un estado final (aprobado o rechazado)

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
