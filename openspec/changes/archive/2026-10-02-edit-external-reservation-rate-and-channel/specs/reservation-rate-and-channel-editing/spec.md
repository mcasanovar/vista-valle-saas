## Purpose

Permite al administrador registrar el valor por noche que un canal externo cobró realmente por una reserva, y corregir el canal al que una reserva fue atribuida, de modo que el registro y el resumen de ingresos reflejen lo que el huésped pagó en lugar de la tarifa de la web.

## ADDED Requirements

### Requirement: Elegibilidad de la sobrescritura por canal externo

El sistema SHALL permitir fijar a mano el valor por noche únicamente en reservas cuyo origen sea Airbnb o Booking. El sistema SHALL NOT ofrecer la sobrescritura en reservas de origen web, teléfono, WhatsApp o administración, que conservan el valor resuelto por el servidor desde la tarifa vigente de la habitación.

#### Scenario: Reserva de canal externo

- **WHEN** el administrador abre una reserva cuyo origen es Airbnb o Booking
- **THEN** el sistema ofrece el valor por noche como campo editable para cada habitación de la reserva

#### Scenario: Reserva del sitio público

- **WHEN** el administrador abre una reserva cuyo origen es el sitio web
- **THEN** el sistema no ofrece editar el valor por noche y muestra el valor resuelto desde la tarifa vigente

#### Scenario: Reserva de teléfono, WhatsApp o administración

- **WHEN** el administrador abre una reserva de origen teléfono, WhatsApp o administración
- **THEN** el sistema no ofrece editar el valor por noche

### Requirement: Valor por noche por habitación

El sistema SHALL tratar el valor por noche como un dato de cada habitación de la reserva, permitiendo fijar un valor distinto por habitación en una reserva de varias habitaciones y dejando sin sobrescribir las habitaciones cuyo valor el administrador no modifica. El sistema SHALL aceptar únicamente un monto entero en pesos mayor que cero, y SHALL rechazar cualquier otro valor informando el motivo sin modificar la reserva.

#### Scenario: Sobrescritura de una habitación en una reserva de varias

- **WHEN** el administrador fija el valor por noche de una habitación de una reserva que tiene varias
- **THEN** el sistema aplica el valor solo a esa habitación y conserva en las demás el valor que ya tenían

#### Scenario: Valor cero o negativo

- **WHEN** el administrador envía un valor por noche de cero o negativo
- **THEN** el sistema rechaza la operación indicando que el valor debe ser mayor que cero, y la reserva queda intacta

#### Scenario: Valor no entero

- **WHEN** el administrador envía un valor por noche que no es un número entero de pesos
- **THEN** el sistema rechaza la operación indicando el formato esperado, y la reserva queda intacta

### Requirement: Sobrescritura al crear una reserva manual

El sistema SHALL permitir indicar el valor por noche de cada habitación en el momento de crear a mano una reserva de origen Airbnb o Booking. Cuando el administrador no indica un valor, el sistema SHALL resolverlo desde la tarifa vigente de la habitación para la ocupación solicitada, igual que hoy.

#### Scenario: Creación con valor indicado

- **WHEN** el administrador crea una reserva de Booking indicando un valor por noche distinto de la tarifa vigente
- **THEN** el sistema crea la reserva con ese valor, calcula el total a partir de él y lo registra como valor fijado a mano

#### Scenario: Creación sin valor indicado

- **WHEN** el administrador crea una reserva de Airbnb sin indicar valor por noche
- **THEN** el sistema resuelve la tarifa vigente por ocupación y la reserva no queda marcada con valor manual

### Requirement: Sobrescritura en cualquier momento y cualquier estado

El sistema SHALL permitir fijar o modificar el valor por noche de una reserva de canal externo en cualquier momento posterior a su creación, sin restricción por estado: una reserva confirmada, completada, cancelada o marcada como no presentada SHALL ser editable. Fijar el valor por noche SHALL NOT modificar el estado de la reserva.

#### Scenario: Reserva completada

- **WHEN** el administrador fija el valor por noche de una reserva ya completada
- **THEN** el sistema aplica el valor, recalcula el total y la reserva conserva el estado completado

#### Scenario: Reserva cancelada

- **WHEN** el administrador fija el valor por noche de una reserva cancelada
- **THEN** el sistema aplica el valor como corrección de registro, la reserva conserva el estado cancelado, y el resumen mensual no se altera porque solo considera reservas confirmadas y completadas

### Requirement: Recálculo del total y conciliación de pagos

El sistema SHALL recalcular, al fijar el valor por noche, el subtotal de la habitación a partir de las noches de la estadía y el valor fijado, y el total de la reserva como la suma de sus habitaciones más los cargos aplicables. El sistema SHALL NOT aceptar un subtotal o un total enviados por el navegador. El sistema SHALL conciliar los pagos con el total resultante aplicando el mismo criterio que una edición de estadía: conserva los pagos aprobados, deja como importe pendiente la diferencia a favor cuando el total supera lo pagado, y cuando lo pagado supera el total deja constancia del sobrepago para resolución manual sin generar un cobro adicional.

En una reserva **cancelada** el sistema SHALL NOT abrir ningún importe pendiente, porque sus pagos ya fueron cancelados al cancelarla y la edición es una corrección de registro que nadie va a cobrar; si sobrevive un importe pendiente, el sistema SHALL cancelarlo en lugar de ajustarlo al alza. El sistema SHALL informar igualmente el importe pagado considerado y el saldo o sobrepago calculado, para que la auditoría de la corrección quede completa.

#### Scenario: Aumento del valor en una reserva sin pagos aprobados

- **WHEN** el administrador sube el valor por noche de una reserva que no tiene pagos aprobados
- **THEN** el sistema reemplaza el importe pendiente por el total recalculado

#### Scenario: Aumento del valor con pago aprobado

- **WHEN** el total recalculado supera la suma de los pagos aprobados
- **THEN** el sistema conserva los pagos aprobados y deja pendiente la diferencia

#### Scenario: Reducción del valor con pago aprobado

- **WHEN** el total recalculado queda por debajo de la suma de los pagos aprobados
- **THEN** el sistema conserva los pagos aprobados, deja constancia del sobrepago para resolución manual y no genera un cobro adicional

#### Scenario: Reserva cancelada cuyo valor sube

- **WHEN** el administrador sube el valor por noche de una reserva cancelada
- **THEN** el sistema recalcula el subtotal y el total, no abre ningún importe pendiente por la diferencia, y registra en la auditoría el importe pagado considerado y el saldo calculado

#### Scenario: Resumen mensual del panel

- **WHEN** el administrador corrige el valor por noche de una reserva confirmada o completada del mes en curso
- **THEN** el ingreso del mes que informa el panel refleja el valor corregido

### Requirement: Persistencia de la sobrescritura frente a ediciones posteriores

El sistema SHALL conservar el valor por noche fijado a mano cuando el administrador edita después la estadía de la reserva. Una edición de fechas, de habitaciones o de ocupación SHALL recalcular noches, subtotales y total, pero SHALL mantener para cada habitación con valor manual ese valor en lugar de volver a resolverlo desde la tarifa vigente. Una habitación que se agrega a la estadía SHALL tomar la tarifa vigente, porque no tiene valor manual propio. El sistema SHALL permitir al administrador descartar la sobrescritura y volver al valor resuelto desde la tarifa vigente.

#### Scenario: Edición de fechas sobre un valor manual

- **WHEN** el administrador edita las fechas de una reserva cuyo valor por noche fue fijado a mano
- **THEN** el sistema recalcula las noches y el total usando el valor fijado a mano, sin devolverlo a la tarifa vigente

#### Scenario: Habitación agregada a una reserva con valor manual

- **WHEN** el administrador agrega una habitación a una reserva que tenía otra habitación con valor manual
- **THEN** la habitación agregada toma la tarifa vigente por ocupación y la habitación anterior conserva su valor manual

#### Scenario: Vuelta a la tarifa vigente

- **WHEN** el administrador descarta la sobrescritura de una habitación
- **THEN** el sistema vuelve a resolver el valor desde la tarifa vigente para la ocupación de esa habitación, recalcula el total y la habitación deja de estar marcada con valor manual

### Requirement: Distinción visible entre valor manual y tarifa vigente

El sistema SHALL distinguir en el detalle administrativo de la reserva cuáles habitaciones tienen un valor por noche fijado a mano y cuáles usan la tarifa vigente, de modo que el administrador no interprete un valor manual como la tarifa configurada de la habitación.

#### Scenario: Reserva con valor manual

- **WHEN** el administrador consulta una reserva con el valor por noche fijado a mano
- **THEN** el detalle identifica ese valor como fijado a mano y no como la tarifa vigente de la habitación

### Requirement: Los precios base no cambian

Fijar el valor por noche de una reserva SHALL afectar únicamente a esa reserva. El sistema SHALL NOT modificar la tarifa configurada de la habitación, su configuración de precio por ocupación, ni el valor que el sitio público cotiza a cualquier otro visitante.

#### Scenario: La tarifa de la habitación queda intacta

- **WHEN** el administrador fija un valor por noche distinto de la tarifa vigente en una reserva
- **THEN** la configuración de tarifas de esa habitación y la cotización del sitio público quedan sin cambios

### Requirement: Corrección del origen de una reserva

El sistema SHALL permitir corregir el origen de cualquier reserva a cualquiera de los seis orígenes del sistema —sitio web, Airbnb, Booking, teléfono, WhatsApp y administración— para enmendar un error de ingreso. El sistema SHALL reflejar el origen corregido en el listado administrativo y en el desglose de reservas por canal del resumen mensual. Corregir el origen SHALL NOT modificar el estado de la reserva, sus fechas ni sus habitaciones.

#### Scenario: Reserva ingresada con el origen equivocado

- **WHEN** el administrador corrige a Booking el origen de una reserva que había ingresado como Airbnb
- **THEN** el sistema registra el origen corregido, y tanto el listado administrativo como el desglose por canal del resumen mensual la atribuyen a Booking

#### Scenario: Corrección desde un origen que no es de canal

- **WHEN** el administrador corrige a Booking el origen de una reserva ingresada como administración, teléfono o WhatsApp
- **THEN** el sistema registra el origen corregido y la reserva pasa a admitir un valor por noche propio

#### Scenario: Corrección de una reserva del sitio web

- **WHEN** el administrador corrige el origen de una reserva originada en el sitio web
- **THEN** el sistema aplica la corrección, advirtiendo que reetiquetar una reserva que el huésped creó en el sitio cambia la atribución de su pago en el resumen mensual

#### Scenario: Corrección en una reserva cerrada o cancelada

- **WHEN** el administrador corrige el origen de una reserva completada o cancelada
- **THEN** el sistema aplica la corrección y la reserva conserva su estado

### Requirement: El valor fijado a mano se suelta al salir de un canal externo

Cuando una corrección de origen lleve la reserva a un origen que no es Airbnb ni Booking, el sistema SHALL descartar todo valor por noche fijado a mano, volver a resolver cada habitación afectada desde su tarifa vigente por ocupación, recalcular subtotales y total, y conciliar los pagos con el mismo criterio que una edición del valor por noche —incluida la excepción de las reservas canceladas, que no abren importe pendiente. El sistema SHALL aplicar el cambio de origen y ese recálculo como una sola operación atómica: si el recálculo falla, el origen tampoco cambia.

Cuando la corrección mantenga la reserva en un origen de canal externo, o cuando ninguna habitación tenga un valor fijado a mano, el sistema SHALL NOT modificar valores, total ni pagos.

#### Scenario: Reserva de Booking con valor manual corregida a administración

- **WHEN** el administrador corrige a administración el origen de una reserva de Booking cuyo valor por noche estaba fijado a mano
- **THEN** el sistema vuelve a resolver el valor desde la tarifa vigente de la habitación, recalcula el total, concilia los pagos y deja la reserva sin valor fijado a mano

#### Scenario: Corrección entre dos canales externos

- **WHEN** el administrador corrige de Airbnb a Booking una reserva con valor por noche fijado a mano
- **THEN** el valor fijado a mano, el total y los pagos quedan sin cambios

#### Scenario: Corrección de una reserva sin valor manual

- **WHEN** el administrador corrige el origen de una reserva cuyas habitaciones usan la tarifa vigente
- **THEN** el sistema cambia solo el origen y no toca valores, total ni pagos

#### Scenario: Reserva cancelada que suelta su valor manual

- **WHEN** el administrador corrige a administración el origen de una reserva cancelada con valor fijado a mano
- **THEN** el sistema vuelve a la tarifa vigente y recalcula el total sin abrir ningún importe pendiente

### Requirement: Auditoría de la sobrescritura y de la corrección de canal

El sistema SHALL registrar un evento de auditoría por cada valor por noche fijado, modificado o descartado, con el administrador responsable, la habitación afectada, el valor anterior y el nuevo, el total anterior y el nuevo, el importe pagado considerado y el saldo o sobrepago resultante. El sistema SHALL registrar un evento de auditoría por cada corrección de origen, con el administrador responsable, el origen anterior y el nuevo, y —cuando la corrección haya soltado un valor fijado a mano— los valores y totales anterior y nuevo. El sistema SHALL NOT notificar al huésped ninguna de las dos operaciones.

#### Scenario: Valor por noche fijado

- **WHEN** el administrador fija el valor por noche de una reserva
- **THEN** el sistema conserva un evento de auditoría con el responsable, la habitación, el valor anterior y el nuevo, los totales anterior y nuevo, y el saldo o sobrepago resultante

#### Scenario: Origen corregido

- **WHEN** el administrador corrige el origen de una reserva
- **THEN** el sistema conserva un evento de auditoría con el responsable, el origen anterior y el nuevo

#### Scenario: Origen corregido soltando un valor manual

- **WHEN** una corrección de origen descarta un valor por noche fijado a mano
- **THEN** el evento de auditoría registra además el valor y el total anteriores y los nuevos

#### Scenario: Operación rechazada

- **WHEN** la operación falla por autorización, elegibilidad o por un valor inválido
- **THEN** el sistema no registra la operación como exitosa, no modifica la reserva y no envía ninguna comunicación
