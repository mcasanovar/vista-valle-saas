## MODIFIED Requirements

### Requirement: Precio autoritativo para cotización de reserva
El sistema SHALL calcular el precio de cada ítem de una cotización, hold o reserva —incluida la reserva manual creada desde el dashboard admin— a partir del precio resuelto para la ocupación asignada a esa habitación específica, y MUST NOT aceptar un precio por noche provisto por el cliente ni usar el precio base de la habitación sin resolver cuando existan tarifas por ocupación configuradas.

#### Scenario: Cotización de un ítem multi-habitación
- **WHEN** se cotiza una reserva con varias habitaciones, cada una con una cantidad de personas asignada
- **THEN** el sistema calcula el subtotal de cada habitación usando el precio resuelto para su propia ocupación, independientemente de las demás habitaciones de la misma reserva

#### Scenario: Reserva manual creada desde el dashboard admin
- **WHEN** un administrador crea una reserva manual para una habitación con tarifas por ocupación configuradas
- **THEN** el sistema resuelve el precio de esa habitación con la misma lógica de resolución por ocupación que usa la reserva pública, en vez de su precio base sin resolver
