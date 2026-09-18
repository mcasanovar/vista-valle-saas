## MODIFIED Requirements

### Requirement: Elegibilidad por origen

El sistema SHALL permitir la edición de fechas para reservas de cualquier origen (`website`, `phone`, `whatsapp`, `admin`, `airbnb` o `booking`) y en cualquier estado (`confirmed`, `cancelled`, `completed` o `no_show`). Editar las fechas SHALL NOT modificar el estado de la reserva: una reserva cancelada, completada o no presentada conserva ese estado después de la edición.

#### Scenario: Reserva de Airbnb o Booking

- **WHEN** el administrador edita las fechas de una reserva originada en Airbnb o Booking
- **THEN** el sistema aplica el mismo recálculo transaccional que a cualquier otro origen y confirma el cambio, sin requerir ninguna acción en la plataforma externa

#### Scenario: Reserva cancelada, completada o no presentada

- **WHEN** el administrador edita las fechas de una reserva que está cancelada, completada o marcada como no presentada
- **THEN** el sistema aplica el mismo recálculo de fechas, precio y saldo, y la reserva conserva su estado original
