## ADDED Requirements

### Requirement: Estado de pago cancelado en el listado de reservas
El listado de reservas SHALL mostrar el estado de pago de una reserva cancelada como cancelado, en vez de pendiente o pagado, sin importar el estado que tuvieran sus pagos antes de la cancelación.

#### Scenario: Reserva cancelada con pago previamente aprobado
- **WHEN** el administrador ve el listado de reservas y una reserva cancelada tenía un pago aprobado antes de cancelarse
- **THEN** el sistema muestra el estado de pago de esa fila como cancelado, no como pagado

#### Scenario: Reserva cancelada con pago previamente pendiente
- **WHEN** el administrador ve el listado de reservas y una reserva cancelada tenía un pago pendiente antes de cancelarse
- **THEN** el sistema muestra el estado de pago de esa fila como cancelado, no como pendiente

## MODIFIED Requirements

### Requirement: Auditoría administrativa
El sistema SHALL registrar actor, fecha y cambio para operaciones sensibles sobre reservas, pagos, bloqueos y sincronización manual.

#### Scenario: Cancelación administrativa
- **WHEN** un administrador cancela una reserva
- **THEN** el sistema conserva un evento de auditoría con el estado anterior, el nuevo estado y el responsable

#### Scenario: Cancelación administrativa con pagos asociados
- **WHEN** un administrador cancela una reserva que tiene uno o más pagos asociados
- **THEN** el sistema conserva, además del evento de auditoría de la reserva, un evento de auditoría por cada pago cancelado automáticamente, con su estado anterior, su nuevo estado (`cancelled`) y el responsable
