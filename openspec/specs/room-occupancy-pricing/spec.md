# room-occupancy-pricing Specification

## Purpose
Define cómo se resuelve el precio por noche de una habitación según la cantidad de personas (1 o 2) que se alojan en ella, incluyendo el comportamiento de respaldo para habitaciones sin tarifas diferenciadas configuradas.

## Requirements

### Requirement: Resolución de precio por ocupación
El sistema SHALL resolver el precio por noche de una habitación a partir de la cantidad de personas (1 o 2) asignadas a esa habitación específica, usando sus tarifas configuradas, y SHALL aplicar el mismo precio para 1 o 2 personas cuando la habitación esté marcada con precio fijo o no tenga tarifas por ocupación configuradas.

#### Scenario: Habitación con tarifas diferenciadas
- **WHEN** se resuelve el precio de una habitación que tiene un precio configurado para 1 persona y otro distinto para 2 personas
- **THEN** el sistema devuelve el precio correspondiente a la cantidad de personas solicitada

#### Scenario: Habitación marcada con precio fijo
- **WHEN** se resuelve el precio de una habitación marcada para cobrar el mismo valor sin importar la ocupación
- **THEN** el sistema devuelve ese mismo precio tanto para 1 como para 2 personas

#### Scenario: Habitación sin tarifas por ocupación configuradas
- **WHEN** se resuelve el precio de una habitación que aún no tiene tarifas por ocupación cargadas
- **THEN** el sistema devuelve su precio base por noche existente, sin importar si se solicita para 1 o 2 personas

### Requirement: Validación de ocupación dentro de la capacidad de la habitación
El sistema SHALL restringir la resolución y configuración de precio por ocupación a valores entre 1 y la capacidad de la habitación, y SHALL rechazar una solicitud de precio para una ocupación fuera de ese rango.

#### Scenario: Ocupación fuera de rango
- **WHEN** se solicita el precio de una habitación para una cantidad de personas mayor a su capacidad o menor a 1
- **THEN** el sistema rechaza la solicitud sin devolver un precio

### Requirement: Configuración independiente por habitación
El sistema SHALL permitir configurar tarifas por ocupación de forma independiente para cualquier habitación activa, sin limitar esta capacidad a una habitación específica del catálogo.

#### Scenario: Nueva habitación sin configurar
- **WHEN** una habitación activa aún no tiene tarifas por ocupación configuradas
- **THEN** el sistema resuelve su precio mediante el comportamiento de respaldo hasta que se configuren tarifas propias para esa habitación

### Requirement: Precio autoritativo para cotización de reserva
El sistema SHALL calcular el precio de cada ítem de una cotización, hold o reserva a partir del precio resuelto para la ocupación asignada a esa habitación específica, y MUST NOT aceptar un precio por noche provisto por el cliente.

#### Scenario: Cotización de un ítem multi-habitación
- **WHEN** se cotiza una reserva con varias habitaciones, cada una con una cantidad de personas asignada
- **THEN** el sistema calcula el subtotal de cada habitación usando el precio resuelto para su propia ocupación, independientemente de las demás habitaciones de la misma reserva
