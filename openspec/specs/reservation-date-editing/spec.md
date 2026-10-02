# reservation-date-editing Specification

## Purpose

Permitir que el personal autorizado ajuste la estadía completa de una reserva elegible —sus fechas, el conjunto de habitaciones y la cantidad de personas de cada habitación— en una sola operación, sin perder consistencia de disponibilidad, precios, pagos ni trazabilidad operativa.

## Requirements

### Requirement: Edición transaccional de la estadía

El sistema SHALL permitir a un administrador autorizado modificar, en una sola operación, el `check-in`, el `check-out`, el conjunto de habitaciones y la cantidad de personas de cada habitación de una reserva elegible, usando fechas de alojamiento bajo `America/Santiago`, y SHALL confirmar el cambio solo si el nuevo intervalo es válido, la ocupación solicitada de cada habitación resultante cabe en su capacidad, y todas las habitaciones de la estadía resultante están disponibles en el intervalo solicitado. El sistema SHALL aplicar todos los cambios de la operación o ninguno, y SHALL conservar la disponibilidad, las fechas, las habitaciones y la ocupación anteriores cuando la operación se rechace.

#### Scenario: Extensión de una reserva de una habitación

- **WHEN** el administrador cambia el `check-out` de una reserva elegible a una fecha posterior, sin modificar sus habitaciones
- **THEN** el sistema revalida el intervalo, bloquea la habitación durante la operación y actualiza las fechas de la reserva sin crear una segunda reserva

#### Scenario: Modificación de una reserva multi-habitación

- **WHEN** el administrador modifica las fechas de una reserva con varias habitaciones
- **THEN** el sistema aplica las mismas fechas a todos sus ítems y confirma todos los cambios o ninguno

#### Scenario: Cambio de la cantidad de personas de una habitación

- **WHEN** el administrador cambia la cantidad de personas de una habitación que la reserva conserva, sin modificar las fechas ni el conjunto de habitaciones
- **THEN** el sistema actualiza la ocupación de ese ítem y recalcula su tarifa según el precio por ocupación vigente de esa habitación

#### Scenario: Habitación agregada a la reserva

- **WHEN** el administrador agrega una habitación a la estadía con una cantidad de personas
- **THEN** el sistema verifica que esa habitación esté disponible en el intervalo de la estadía y la incorpora como un ítem nuevo con su tarifa por ocupación, sin alterar los ítems que la reserva conserva

#### Scenario: Habitación quitada de la reserva

- **WHEN** el administrador quita una habitación de una estadía que conserva al menos otra habitación
- **THEN** el sistema elimina ese ítem con sus cargos, libera la disponibilidad de esa habitación en el intervalo de la estadía y conserva los ítems restantes

#### Scenario: Intercambio de una habitación por otra

- **WHEN** el administrador quita una habitación y agrega otra en la misma operación
- **THEN** el sistema verifica la disponibilidad de la habitación entrante, libera la saliente y confirma ambos efectos en la misma operación, o rechaza la operación completa sin dejar la reserva con ninguna de las dos

#### Scenario: Conflicto en una de las habitaciones

- **WHEN** la estadía solicitada se superpone con una reserva, retención o bloqueo de cualquiera de sus habitaciones, excluyendo la propia reserva editada
- **THEN** el sistema rechaza la modificación, conserva las fechas, las habitaciones, la ocupación y la disponibilidad anteriores y muestra el conflicto

#### Scenario: Concurrencia sobre una habitación que se agrega

- **WHEN** el administrador agrega una habitación mientras otra operación intenta tomar esa misma habitación en un intervalo superpuesto
- **THEN** el sistema serializa ambas operaciones y solo una de las dos queda confirmada

#### Scenario: Ocupación mayor que la capacidad

- **WHEN** el administrador solicita para una habitación una cantidad de personas mayor que su capacidad
- **THEN** el sistema rechaza la modificación y no cambia la reserva

#### Scenario: Intervalo inválido

- **WHEN** el administrador envía un `check-out` igual o anterior al `check-in`
- **THEN** el sistema rechaza la modificación y no cambia la reserva

### Requirement: Elegibilidad por origen

El sistema SHALL permitir la edición de la estadía para reservas de cualquier origen (`website`, `phone`, `whatsapp`, `admin`, `airbnb` o `booking`) y en cualquier estado (`confirmed`, `cancelled`, `completed` o `no_show`). Editar la estadía SHALL NOT modificar el estado de la reserva: una reserva cancelada, completada o no presentada conserva ese estado después de la edición.

#### Scenario: Reserva de Airbnb o Booking

- **WHEN** el administrador edita la estadía de una reserva originada en Airbnb o Booking
- **THEN** el sistema aplica el mismo recálculo transaccional que a cualquier otro origen y confirma el cambio, sin requerir ninguna acción en la plataforma externa

#### Scenario: Reserva cancelada, completada o no presentada

- **WHEN** el administrador edita la estadía de una reserva que está cancelada, completada o marcada como no presentada
- **THEN** el sistema aplica el mismo recálculo de fechas, habitaciones, ocupación, precio y saldo, y la reserva conserva su estado original

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

### Requirement: Auditoría y comunicación del cambio

El sistema SHALL registrar una auditoría del cambio con administrador, fechas anteriores y nuevas, habitaciones anteriores y nuevas identificando las que entran y las que salen, cantidad de personas anterior y nueva por habitación, totales anteriores y nuevos, importe pagado considerado, saldo pendiente y eventual sobrepago. El sistema SHALL actualizar el detalle administrativo y SHALL generar una única comunicación transaccional dirigida al destinatario administrativo configurado que describa el cambio de estadía. El sistema SHALL NOT notificar al huésped el cambio de estadía.

#### Scenario: Modificación confirmada

- **WHEN** una modificación de estadía se confirma correctamente
- **THEN** el detalle muestra las nuevas fechas, habitaciones, personas por habitación, noches, total, pagos, saldo y cualquier sobrepago, y la auditoría identifica al administrador y los valores modificados

#### Scenario: Comunicación de un cambio de habitaciones

- **WHEN** una modificación de estadía que agrega, quita o intercambia habitaciones se confirma correctamente
- **THEN** el destinatario administrativo recibe una única comunicación que identifica las habitaciones que entran, las que salen y la cantidad de personas resultante por habitación, y el huésped no recibe ninguna comunicación por ese cambio

#### Scenario: Modificación rechazada

- **WHEN** la modificación falla por autorización, elegibilidad, intervalo, capacidad, disponibilidad o por quedar sin habitaciones
- **THEN** no se registra un cambio de fechas, habitaciones, ocupación, precio o pago como exitoso ni se envía una comunicación de modificación

### Requirement: Estadía con al menos una habitación

El sistema SHALL rechazar toda edición de estadía cuya habitación resultante sea ninguna, informando al administrador que una reserva no puede quedar sin habitaciones, y SHALL presentarlo como un resultado de negocio de la operación y no como una falla inesperada.

#### Scenario: Intento de quitar la única habitación

- **WHEN** el administrador quita la única habitación que tiene la reserva
- **THEN** el sistema rechaza la operación con un mensaje que explica que la reserva debe conservar al menos una habitación, y la reserva queda intacta

#### Scenario: Intento de quitar todas las habitaciones de una reserva multi-habitación

- **WHEN** el administrador quita todas las habitaciones de una reserva que tenía varias
- **THEN** el sistema rechaza la operación y conserva todas las habitaciones, fechas y ocupación anteriores

### Requirement: Disponibilidad de edición sin regla de fecha mínima

El sistema SHALL calcular la disponibilidad que ofrece el formulario de edición de estadía sin aplicar la regla de fecha mínima del flujo público de reservas, y SHALL excluir del cálculo de solapamiento a la propia reserva que se está editando. El sistema SHALL ofrecer como seleccionable toda habitación que esté libre en el intervalo solicitado, incluida la que la reserva ya ocupa.

#### Scenario: Cambio de habitación en una reserva en curso

- **WHEN** el administrador edita la estadía de una reserva cuyo `check-in` ya transcurrió
- **THEN** el sistema ofrece las habitaciones disponibles para ese intervalo y permite confirmar el cambio, sin rechazarlo por tener una fecha de entrada pasada

#### Scenario: La habitación propia no se reporta ocupada

- **WHEN** el administrador abre el formulario de edición de una reserva
- **THEN** las habitaciones que la propia reserva ocupa aparecen como seleccionadas y disponibles, no como ocupadas por un tercero

### Requirement: Advertencia de sincronización por habitación

El sistema SHALL advertir al administrador, antes de confirmar una edición de estadía que agrega, quita o intercambia habitaciones, que el cambio no se propaga a Airbnb ni a Booking por sí solo, y SHALL señalar de forma explícita cuando alguna habitación de la estadía resultante no tenga una conexión de canal activa, indicando que en ese caso la sincronización con los canales externos cambia de comportamiento.

#### Scenario: Habitación entrante sin conexión de canal activa

- **WHEN** el administrador agrega o intercambia hacia una habitación que no tiene una conexión de canal activa
- **THEN** el sistema identifica esa habitación en la advertencia antes de confirmar, para que el administrador sepa que su disponibilidad no se sincronizará con los canales externos

#### Scenario: Cambio de habitaciones entre habitaciones conectadas

- **WHEN** el administrador intercambia habitaciones que ambas tienen conexión de canal activa
- **THEN** el sistema advierte que el cambio requiere verificación manual en los canales externos, sin señalar ninguna habitación como desconectada
