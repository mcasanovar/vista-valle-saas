# payment-processing Specification

## Purpose

TBD - Update Purpose after archive. (A fuller draft of this capability's Purpose exists in the delta at `openspec/changes/build-vista-valle-booking-mvp/specs/payment-processing/spec.md`, which has not yet been synced.)

## Requirements

### Requirement: Selección de modalidad de pago al confirmar reserva
El sistema SHALL permitir al huésped elegir entre pago al llegar y pago en línea al confirmar una reserva de una o más habitaciones, restringido a los métodos que el administrador tenga habilitados en la configuración de métodos de pago. Cuando más de un método de pago en línea esté habilitado, SHALL permitir al huésped elegir entre ellos. El sistema SHALL registrar la modalidad elegida (`pay_at_property` o `pay_now`) junto con el proveedor de pago usado cuando la modalidad sea pago en línea. El sistema SHALL validar en el servidor, al recibir la solicitud de confirmación, que el método solicitado esté habilitado, además de ocultarlo en la interfaz cuando esté deshabilitado.

#### Scenario: Huésped elige pago en línea
- **WHEN** el huésped confirma una reserva y selecciona un método de pago en línea habilitado
- **THEN** el sistema registra la reserva con modalidad `pay_now` y el proveedor de pago correspondiente al método elegido, y no la marca como pagada hasta recibir confirmación autoritativa de ese proveedor

#### Scenario: Huésped elige pago al llegar
- **WHEN** el huésped confirma una reserva y selecciona pago al llegar, estando ese método habilitado
- **THEN** el sistema registra la reserva con modalidad `pay_at_property` sin iniciar ningún flujo de pago en línea, igual que en el comportamiento existente

#### Scenario: Método deshabilitado no se muestra
- **WHEN** el administrador deshabilitó un método de pago y el huésped llega al paso de selección de método de pago
- **THEN** el sistema no muestra la opción deshabilitada, mostrando únicamente los métodos habilitados

#### Scenario: Solicitud directa a un método deshabilitado
- **WHEN** una solicitud llega a los endpoints de confirmación de reserva pidiendo un método de pago que está deshabilitado, sin pasar por la interfaz de selección
- **THEN** el sistema rechaza la solicitud y no crea ni confirma la reserva con ese método

#### Scenario: Ambos métodos deshabilitados
- **WHEN** el administrador deshabilitó todos los métodos de pago disponibles
- **THEN** el sistema no muestra ninguna opción de pago en el paso de selección, sin un mensaje de bloqueo especial distinto al de la ausencia de opciones

### Requirement: Pago en línea con reservas de múltiples habitaciones
El sistema SHALL permitir pagar en línea una reserva de dos o más habitaciones exactamente igual que una de una sola habitación: como un único pago por el total de todas las habitaciones. El sistema SHALL NOT crear más de un pago por reserva ni ofrecer reembolsos o liberaciones parciales por habitación individual.

#### Scenario: Huésped paga en línea dos o más habitaciones
- **WHEN** el huésped confirma una reserva de dos o más habitaciones y elige un método de pago en línea habilitado
- **THEN** el sistema retiene todas las habitaciones seleccionadas bajo una única retención, crea un único pago por el total, y confirma la reserva completa (con todas sus habitaciones) solo cuando ese pago único es aprobado

#### Scenario: Pago rechazado o retención vencida con múltiples habitaciones
- **WHEN** el pago único de una reserva de múltiples habitaciones es rechazado o su retención vence sin confirmarse
- **THEN** el sistema libera la disponibilidad de todas las habitaciones de esa retención en conjunto, sin dejar ninguna reservada parcialmente

### Requirement: Contracargo posterior a un pago en línea aprobado
El sistema SHALL soportar un estado de pago `charged_back`, distinto de rechazado, cancelado y reembolsado, para cuando un proveedor de pago en línea reporta un contracargo sobre un pago que ya había sido aprobado. El sistema SHALL NOT revertir automáticamente una reserva confirmada ni su disponibilidad al recibir un contracargo.

#### Scenario: Contracargo sobre un pago ya aprobado
- **WHEN** el proveedor de pago informa un contracargo sobre un pago que ya estaba en estado aprobado
- **THEN** el sistema registra el pago como `charged_back` y no modifica automáticamente el estado de la reserva ni libera la habitación

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
