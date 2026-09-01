# fintoc-payment-integration Specification

## Purpose

Permite que un huésped pague su reserva en línea a través de Fintoc Checkout, y que el sistema confirme, rastree y reembolse ese pago de forma confiable a partir de los eventos que envía Fintoc.

## Requirements

### Requirement: Creación de sesión de pago Fintoc
El sistema SHALL crear una Fintoc Checkout Session al confirmar una reserva con modalidad de pago online, usando el monto exacto de la reserva en la unidad mínima de CLP, y SHALL asociar el `id` de esa sesión al registro de pago de la reserva antes de redirigir al huésped.

#### Scenario: Reserva con pago online seleccionado
- **WHEN** el huésped confirma una reserva y elige pagar en línea con Fintoc
- **THEN** el sistema crea una checkout session en Fintoc por el monto total de la reserva y redirige al huésped a la URL de pago de esa sesión

#### Scenario: Fintoc no disponible al crear la sesión
- **WHEN** la API de Fintoc devuelve un error o no responde al crear la checkout session
- **THEN** el sistema no confirma la reserva como pagada, informa el error al huésped, y permite reintentar o elegir pago al llegar

### Requirement: Confirmación de pago vía webhook
El sistema SHALL exponer un endpoint de webhook que reciba los eventos `checkout_session.finished`, `payment_intent.succeeded`, `payment_intent.failed` y `payment_intent.requires_action` de Fintoc, SHALL verificar la autenticidad del evento antes de procesarlo, y SHALL actualizar el estado de pago de la reserva asociada según el resultado.

#### Scenario: Pago exitoso confirmado por webhook
- **WHEN** el sistema recibe un evento `payment_intent.succeeded` para una sesión con pago pendiente
- **THEN** el estado de pago de la reserva pasa a aprobado y la reserva queda confirmada

#### Scenario: Pago rechazado confirmado por webhook
- **WHEN** el sistema recibe un evento `payment_intent.failed`
- **THEN** el estado de pago de la reserva pasa a rechazado y el huésped puede reintentar el pago

#### Scenario: Pago pendiente de aprobación adicional
- **WHEN** el sistema recibe un evento `payment_intent.requires_action`
- **THEN** el estado de pago se mantiene en un estado transicional de "requiere acción" y no se confirma ni rechaza la reserva hasta recibir el evento final

#### Scenario: Evento con firma inválida
- **WHEN** el sistema recibe una solicitud al endpoint de webhook cuya firma no corresponde a Fintoc
- **THEN** el sistema descarta el evento sin modificar ningún estado de pago y responde con un error

#### Scenario: Evento duplicado
- **WHEN** el sistema recibe dos veces el mismo evento de webhook (mismo `id` de evento)
- **THEN** el sistema aplica el efecto una sola vez y no duplica la actualización de estado

### Requirement: Reembolso de pagos Fintoc
El sistema SHALL permitir iniciar, desde el panel administrativo, un reembolso total o parcial de un pago aprobado realizado vía Fintoc, usando el `id` del payment intent asociado, y SHALL reflejar el resultado del reembolso en el estado de pago de la reserva.

#### Scenario: Reembolso total solicitado por un administrador
- **WHEN** un administrador solicita reembolsar el monto completo de un pago aprobado hecho con Fintoc
- **THEN** el sistema crea un reembolso en Fintoc por el monto total y, al confirmarse, marca el pago como reembolsado

#### Scenario: Reembolso parcial solicitado por un administrador
- **WHEN** un administrador solicita reembolsar un monto menor al total pagado
- **THEN** el sistema crea un reembolso parcial en Fintoc por ese monto y registra el saldo reembolsado sin cambiar el pago a "reembolsado" si queda un remanente
