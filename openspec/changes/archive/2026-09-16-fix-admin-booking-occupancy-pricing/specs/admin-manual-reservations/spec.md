## ADDED Requirements

### Requirement: Precio resuelto por ocupación en reserva manual
El sistema SHALL calcular el precio por noche de cada habitación de una reserva manual a partir del precio resuelto para la cantidad de huéspedes asignada a esa habitación específica, usando la misma resolución de tarifas por ocupación que aplica a la reserva pública, tanto en el preview mostrado al administrador como en el monto que finalmente se persiste.

#### Scenario: Preview de precio según huéspedes por habitación
- **WHEN** el administrador selecciona una habitación con tarifas diferenciadas y asigna una cantidad de huéspedes específica
- **THEN** el preview de precio del formulario muestra el monto correspondiente a esa cantidad de huéspedes, no el precio base de la habitación

#### Scenario: Persistencia con precio por ocupación
- **WHEN** el administrador confirma una reserva manual con una o más habitaciones que tienen tarifas por ocupación configuradas
- **THEN** el sistema persiste cada ítem de habitación con el precio resuelto para la cantidad de huéspedes asignada a esa habitación

#### Scenario: Habitación sin tarifas por ocupación configuradas
- **WHEN** el administrador crea una reserva manual para una habitación sin tarifas por ocupación configuradas
- **THEN** el sistema usa el precio base de la habitación, igual que el comportamiento de respaldo de la reserva pública
