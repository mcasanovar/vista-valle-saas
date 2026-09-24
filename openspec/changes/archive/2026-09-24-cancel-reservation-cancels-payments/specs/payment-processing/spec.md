## MODIFIED Requirements

### Requirement: Cancelaciones cancelan el pago asociado
El sistema SHALL cancelar automáticamente todos los pagos asociados a una reserva cuando esa reserva se cancela, sin importar el estado previo del pago (`pending`, `approved`, `rejected`, `requires_action`, u otro), dejando cada pago en estado `cancelled`. El sistema SHALL registrar el estado anterior de cada pago junto con el nuevo estado como parte de la auditoría de la cancelación, de forma que un pago que estuvo `approved` antes de cancelarse quede identificable en el historial aunque su estado vigente ya no lo sea.

#### Scenario: Cancelación de una reserva con pago aprobado
- **WHEN** se cancela una reserva que tiene un pago con estado `approved`
- **THEN** el pago pasa a estado `cancelled` y el evento de auditoría registra `approved` como estado anterior y `cancelled` como estado nuevo

#### Scenario: Cancelación de una reserva con pago pendiente
- **WHEN** se cancela una reserva que tiene un pago con estado `pending`
- **THEN** el pago pasa a estado `cancelled`

#### Scenario: Cancelación de una reserva con múltiples pagos
- **WHEN** se cancela una reserva que tiene más de un pago asociado (por ejemplo, un intento rechazado y uno aprobado)
- **THEN** todos los pagos asociados a esa reserva pasan a estado `cancelled`

## REMOVED Requirements

### Requirement: Cancelaciones con pago aprobado
**Reason**: Reemplazado por "Cancelaciones cancelan el pago asociado" — el administrador pidió que cancelar la reserva cancele el pago automáticamente en vez de preservarlo y advertir en el panel.
**Migration**: Ninguna migración de datos requerida. El comportamiento del panel que mostraba la advertencia de "resolución financiera pendiente" basada en un pago `approved` sobre una reserva cancelada deja de aplicar, porque ese estado ya no ocurre para reservas canceladas a partir de este cambio.
