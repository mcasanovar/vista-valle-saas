## Purpose

Permitir que un huésped pague en línea con tarjeta de crédito o débito, usando Mercado Pago Checkout Pro como proveedor, con confirmación autoritativa vía webhook y manejo explícito de contracargos.

## ADDED Requirements

### Requirement: Creación de preferencia de pago Mercado Pago
El sistema SHALL crear una preferencia de Checkout Pro (una por reserva, cubriendo el total de todas las habitaciones seleccionadas) cuando el huésped elige pagar con tarjeta, referenciando la retención creada, y SHALL redirigir al huésped al `init_point` recibido. La preferencia SHALL limitarse a 1 cuota (sin financiamiento en cuotas) y SHALL establecer `date_of_expiration` igual al vencimiento de la retención asociada.

#### Scenario: Reserva con pago con tarjeta seleccionado
- **WHEN** el huésped confirma una reserva de una o más habitaciones y selecciona pagar con tarjeta, estando ese método habilitado
- **THEN** el sistema crea la retención de todas las habitaciones seleccionadas, crea una preferencia de Mercado Pago por el total con máximo 1 cuota y vencimiento igual al de la retención, y redirige al huésped al checkout de Mercado Pago

#### Scenario: Mercado Pago no disponible al crear la preferencia
- **WHEN** la API de Mercado Pago falla o no responde al crear la preferencia
- **THEN** el sistema no marca la reserva como pagada, conserva la retención existente para que expire por su TTL normal, y muestra al huésped un error genérico sin datos internos del proveedor

### Requirement: Confirmación de pago vía webhook de Mercado Pago
El sistema SHALL verificar la autenticidad de cada notificación de Mercado Pago validando la firma HMAC-SHA256 calculada sobre el manifest (`id`, `request-id`, `ts`) contra el header `x-signature`, antes de procesarla. Dado que la notificación no incluye el estado del pago, el sistema SHALL consultar el estado real del pago a la API de Mercado Pago antes de decidir cualquier transición. El sistema SHALL confirmar la reserva y marcar el pago como aprobado únicamente a partir de esa consulta autoritativa, nunca a partir de la redirección del navegador.

#### Scenario: Pago aprobado confirmado por webhook
- **WHEN** Mercado Pago notifica un pago y la consulta de estado a su API devuelve aprobado
- **THEN** el sistema confirma la reserva con todas sus habitaciones, marca el pago como aprobado y no depende de que el huésped haya vuelto al sitio

#### Scenario: Pago rechazado confirmado por webhook
- **WHEN** la consulta de estado a la API de Mercado Pago devuelve rechazado o cancelado
- **THEN** el sistema marca el pago como fallido, libera la retención completa (todas las habitaciones) y no confirma la reserva

#### Scenario: Pago pendiente o autorizado sin capturar
- **WHEN** la consulta de estado a la API de Mercado Pago devuelve un estado pendiente o de autorización sin captura
- **THEN** el sistema mantiene el pago en estado transicional y la reserva no se considera pagada hasta un estado final

#### Scenario: Notificación con firma inválida
- **WHEN** la firma calculada sobre el manifest no coincide con el header `x-signature` recibido
- **THEN** el sistema rechaza la notificación sin consultar la API de Mercado Pago ni modificar ningún pago

#### Scenario: Notificación duplicada
- **WHEN** Mercado Pago reenvía una notificación ya procesada para el mismo pago y el mismo estado
- **THEN** el sistema reconoce la notificación sin volver a ejecutar la confirmación ni duplicar efectos

### Requirement: Contracargo sobre un pago con tarjeta ya aprobado
El sistema SHALL registrar un estado `charged_back` distinto de rechazado, cancelado y reembolsado cuando Mercado Pago reporta un contracargo sobre un pago previamente aprobado. El sistema SHALL generar una alerta administrativa al ocurrir esto y SHALL NOT revertir automáticamente el estado de la reserva ni liberar la disponibilidad ya confirmada.

#### Scenario: Contracargo recibido sobre una reserva confirmada
- **WHEN** Mercado Pago notifica un contracargo sobre un pago que ya estaba aprobado y con una reserva confirmada
- **THEN** el sistema marca el pago como `charged_back`, genera una alerta para el administrador, y mantiene la reserva confirmada y la habitación ocupada sin cambios automáticos
