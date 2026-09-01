## ADDED Requirements

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
