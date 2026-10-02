## MODIFIED Requirements

### Requirement: Recálculo autoritativo del valor

El sistema SHALL recalcular noches, cargos y total agregado a partir del intervalo, el conjunto de habitaciones y la cantidad de personas de cada habitación de la estadía resultante, tomando los datos confiables de cada habitación y sin aceptar precios, capacidades ni totales enviados por el navegador. Para el valor por noche de cada habitación el sistema SHALL usar la tarifa vigente por ocupación, excepto en las habitaciones que tengan un valor por noche fijado a mano por el administrador, donde SHALL conservar ese valor; una habitación que se agrega a la estadía nunca tiene valor manual propio y SHALL tomar la tarifa vigente.

#### Scenario: Reserva no pagada

- **WHEN** se modifica la estadía de una reserva sin pagos aprobados
- **THEN** el sistema reemplaza el importe pendiente por el total recalculado de la nueva estadía

#### Scenario: Reserva con pago aprobado y saldo adicional

- **WHEN** el total recalculado es mayor que la suma de los pagos aprobados
- **THEN** el sistema conserva los pagos históricos y crea un nuevo pago pendiente por la diferencia

#### Scenario: Reserva reducida con pago aprobado

- **WHEN** el total recalculado es menor que la suma de los pagos aprobados
- **THEN** el sistema conserva los pagos históricos, deja constancia del sobrepago para resolución manual y no crea un cobro adicional

#### Scenario: Reducción por quitar una habitación con pago aprobado

- **WHEN** el administrador quita una habitación de una reserva con pagos aprobados y el total recalculado queda por debajo de lo pagado
- **THEN** el sistema conserva los pagos históricos, deja constancia del sobrepago para resolución manual y no crea un cobro adicional

#### Scenario: Estadía con una habitación de valor fijado a mano

- **WHEN** el administrador edita las fechas o la ocupación de una reserva cuya habitación tiene un valor por noche fijado a mano
- **THEN** el sistema recalcula las noches, el subtotal y el total usando ese valor fijado a mano, sin devolverlo a la tarifa vigente por ocupación

#### Scenario: Habitación agregada a una estadía con valor manual

- **WHEN** el administrador agrega una habitación a una reserva cuya otra habitación tiene valor fijado a mano
- **THEN** la habitación agregada se cotiza con la tarifa vigente para su ocupación y la habitación preexistente conserva su valor fijado a mano
