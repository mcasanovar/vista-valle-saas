## ADDED Requirements

### Requirement: Elegibilidad de la sobrescritura del valor por noche

El sistema SHALL permitir fijar a mano el valor por noche únicamente en reservas cuyo origen sea Airbnb, Booking o WhatsApp, porque en los tres el precio lo determina un acuerdo ajeno a la tarifa configurada: lo que cobró la plataforma, o lo que el administrador negoció con el huésped por mensaje. El sistema SHALL NOT ofrecer la sobrescritura en reservas de origen web, teléfono o administración, que conservan el valor resuelto por el servidor desde la tarifa vigente de la habitación.

La elegibilidad SHALL depender únicamente del origen: el estado de la reserva nunca la restringe, y el sistema SHALL verificarla en el servidor en toda operación que fije un valor, sin confiar en que la interfaz haya ocultado el campo.

#### Scenario: Reserva de canal externo

- **WHEN** el administrador abre una reserva cuyo origen es Airbnb o Booking
- **THEN** el sistema ofrece el valor por noche como campo editable para cada habitación de la reserva

#### Scenario: Reserva de WhatsApp

- **WHEN** el administrador abre una reserva cuyo origen es WhatsApp
- **THEN** el sistema ofrece el valor por noche como campo editable para cada habitación de la reserva, con las mismas reglas de validación, recálculo, conciliación de pagos y auditoría que una reserva de Airbnb o Booking

#### Scenario: Reserva del sitio público

- **WHEN** el administrador abre una reserva cuyo origen es el sitio web
- **THEN** el sistema no ofrece editar el valor por noche y muestra el valor resuelto desde la tarifa vigente

#### Scenario: Reserva de teléfono o administración

- **WHEN** el administrador abre una reserva de origen teléfono o administración
- **THEN** el sistema no ofrece editar el valor por noche

#### Scenario: Operación enviada sobre una reserva no elegible

- **WHEN** se envía una edición del valor por noche de una reserva de origen web, teléfono o administración
- **THEN** el sistema la rechaza indicando que ese origen no admite un valor por noche propio, y la reserva queda intacta

### Requirement: El valor fijado a mano se suelta al pasar a un origen que no lo admite

Cuando una corrección de origen lleve la reserva a un origen que no admite un valor por noche propio —sitio web, teléfono o administración—, el sistema SHALL descartar todo valor por noche fijado a mano, volver a resolver cada habitación afectada desde su tarifa vigente por ocupación, recalcular subtotales y total, y conciliar los pagos con el mismo criterio que una edición del valor por noche —incluida la excepción de las reservas canceladas, que no abren importe pendiente. El sistema SHALL aplicar el cambio de origen y ese recálculo como una sola operación atómica: si el recálculo falla, el origen tampoco cambia.

Cuando la corrección mantenga la reserva en un origen que admite un valor propio —Airbnb, Booking o WhatsApp—, o cuando ninguna habitación tenga un valor fijado a mano, el sistema SHALL NOT modificar valores, total ni pagos.

#### Scenario: Reserva de Booking con valor manual corregida a administración

- **WHEN** el administrador corrige a administración el origen de una reserva de Booking cuyo valor por noche estaba fijado a mano
- **THEN** el sistema vuelve a resolver el valor desde la tarifa vigente de la habitación, recalcula el total, concilia los pagos y deja la reserva sin valor fijado a mano

#### Scenario: Corrección entre dos canales externos

- **WHEN** el administrador corrige de Airbnb a Booking una reserva con valor por noche fijado a mano
- **THEN** el valor fijado a mano, el total y los pagos quedan sin cambios

#### Scenario: Corrección entre un canal externo y WhatsApp

- **WHEN** el administrador corrige de Booking a WhatsApp, o de WhatsApp a Airbnb, una reserva con valor por noche fijado a mano
- **THEN** el valor fijado a mano, el total y los pagos quedan sin cambios, y el sistema no advierte ningún recálculo

#### Scenario: Reserva de WhatsApp con valor manual corregida a teléfono

- **WHEN** el administrador corrige a teléfono el origen de una reserva de WhatsApp cuyo valor por noche estaba fijado a mano
- **THEN** el sistema vuelve a resolver el valor desde la tarifa vigente, recalcula el total, concilia los pagos y deja la reserva sin valor fijado a mano

#### Scenario: Corrección de una reserva sin valor manual

- **WHEN** el administrador corrige el origen de una reserva cuyas habitaciones usan la tarifa vigente
- **THEN** el sistema cambia solo el origen y no toca valores, total ni pagos

#### Scenario: Reserva cancelada que suelta su valor manual

- **WHEN** el administrador corrige a administración el origen de una reserva cancelada con valor fijado a mano
- **THEN** el sistema vuelve a la tarifa vigente y recalcula el total sin abrir ningún importe pendiente

## MODIFIED Requirements

### Requirement: Sobrescritura al crear una reserva manual

El sistema SHALL permitir indicar el valor por noche de cada habitación en el momento de crear a mano una reserva de origen Airbnb, Booking o WhatsApp. Cuando el administrador no indica un valor, el sistema SHALL resolverlo desde la tarifa vigente de la habitación para la ocupación solicitada, igual que hoy. El sistema SHALL ignorar todo valor por noche enviado junto a un origen que no admite la sobrescritura, resolviendo esas habitaciones desde su tarifa vigente.

#### Scenario: Creación con valor indicado

- **WHEN** el administrador crea una reserva de Booking indicando un valor por noche distinto de la tarifa vigente
- **THEN** el sistema crea la reserva con ese valor, calcula el total a partir de él y lo registra como valor fijado a mano

#### Scenario: Creación de una reserva de WhatsApp con valor acordado

- **WHEN** el administrador crea una reserva de WhatsApp indicando el valor por noche que acordó con el huésped
- **THEN** el sistema crea la reserva con ese valor, calcula el total a partir de él y lo registra como valor fijado a mano

#### Scenario: Creación sin valor indicado

- **WHEN** el administrador crea una reserva de Airbnb sin indicar valor por noche
- **THEN** el sistema resuelve la tarifa vigente por ocupación y la reserva no queda marcada con valor manual

#### Scenario: Valor enviado con un origen que no lo admite

- **WHEN** se envía la creación de una reserva de teléfono o administración acompañada de un valor por noche
- **THEN** el sistema descarta ese valor y resuelve cada habitación desde su tarifa vigente por ocupación

### Requirement: Sobrescritura en cualquier momento y cualquier estado

El sistema SHALL permitir fijar o modificar el valor por noche de una reserva cuyo origen admite un valor propio en cualquier momento posterior a su creación, sin restricción por estado: una reserva confirmada, completada, cancelada o marcada como no presentada SHALL ser editable. Fijar el valor por noche SHALL NOT modificar el estado de la reserva.

#### Scenario: Reserva completada

- **WHEN** el administrador fija el valor por noche de una reserva ya completada
- **THEN** el sistema aplica el valor, recalcula el total y la reserva conserva el estado completado

#### Scenario: Reserva cancelada

- **WHEN** el administrador fija el valor por noche de una reserva cancelada
- **THEN** el sistema aplica el valor como corrección de registro, la reserva conserva el estado cancelado, y el resumen mensual no se altera porque solo considera reservas confirmadas y completadas

### Requirement: Corrección del origen de una reserva

El sistema SHALL permitir corregir el origen de cualquier reserva a cualquiera de los seis orígenes del sistema —sitio web, Airbnb, Booking, teléfono, WhatsApp y administración— para enmendar un error de ingreso. El sistema SHALL reflejar el origen corregido en el listado administrativo y en el desglose de reservas por canal del resumen mensual. Corregir el origen SHALL NOT modificar el estado de la reserva, sus fechas ni sus habitaciones.

#### Scenario: Reserva ingresada con el origen equivocado

- **WHEN** el administrador corrige a Booking el origen de una reserva que había ingresado como Airbnb
- **THEN** el sistema registra el origen corregido, y tanto el listado administrativo como el desglose por canal del resumen mensual la atribuyen a Booking

#### Scenario: Corrección desde un origen que no es de canal

- **WHEN** el administrador corrige a Booking o a WhatsApp el origen de una reserva ingresada como administración o teléfono
- **THEN** el sistema registra el origen corregido y la reserva pasa a admitir un valor por noche propio

#### Scenario: Corrección de una reserva del sitio web

- **WHEN** el administrador corrige el origen de una reserva originada en el sitio web
- **THEN** el sistema aplica la corrección, advirtiendo que reetiquetar una reserva que el huésped creó en el sitio cambia la atribución de su pago en el resumen mensual

#### Scenario: Corrección en una reserva cerrada o cancelada

- **WHEN** el administrador corrige el origen de una reserva completada o cancelada
- **THEN** el sistema aplica la corrección y la reserva conserva su estado

## REMOVED Requirements

### Requirement: Elegibilidad de la sobrescritura por canal externo

**Reason**: Reemplazado por "Elegibilidad de la sobrescritura del valor por noche", que incorpora WhatsApp al conjunto elegible y nombra el criterio por lo que decide en lugar de por "canal externo", término que en este sistema designa una plataforma sincronizable (Airbnb y Booking) y que WhatsApp no es.

**Migration**: Ninguna. El requisito nuevo conserva las mismas reglas para Airbnb, Booking, web, teléfono y administración; solo añade WhatsApp al conjunto elegible. No hay datos que migrar: `nightlyPriceManual` ya existe por línea de reserva y ninguna reserva de WhatsApp lo tiene fijado.

### Requirement: El valor fijado a mano se suelta al salir de un canal externo

**Reason**: Reemplazado por "El valor fijado a mano se suelta al pasar a un origen que no lo admite". Con WhatsApp dentro del conjunto elegible, el criterio del descarte ya no es "salir de un canal externo" sino "pasar a un origen que no admite un valor propio".

**Migration**: Ninguna. El comportamiento para los destinos web, teléfono y administración es idéntico; lo único que cambia es que una corrección hacia WhatsApp pasa a ser una relabelación pura, que no toca valores, total ni pagos.
