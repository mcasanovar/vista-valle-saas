## MODIFIED Requirements

### Requirement: Reservas manuales multicanal

El sistema SHALL permitir crear reservas manuales indicando como origen Airbnb, Booking, teléfono, WhatsApp o administración, aplicando las mismas validaciones de disponibilidad que una reserva web. Cuando el origen indicado sea Airbnb o Booking, el sistema SHALL permitir además indicar el valor por noche de cada habitación, y SHALL resolverlo desde la tarifa vigente por ocupación cuando el administrador no lo indique.

#### Scenario: Ingreso de reserva de Booking
- **WHEN** el administrador ingresa una reserva de Booking para una habitación disponible
- **THEN** el sistema la confirma y bloquea esas fechas para nuevas reservas web

#### Scenario: Reserva externa superpuesta
- **WHEN** el administrador intenta ingresar una reserva externa que se superpone con otra ocupación
- **THEN** el sistema rechaza la creación y muestra el conflicto existente

#### Scenario: Ingreso de reserva externa con valor propio del canal
- **WHEN** el administrador ingresa una reserva de Airbnb o Booking indicando un valor por noche distinto de la tarifa vigente
- **THEN** el sistema la confirma con ese valor, calcula el total a partir de él y deja registrado que el valor fue fijado a mano

#### Scenario: Ingreso de reserva de teléfono, WhatsApp o administración
- **WHEN** el administrador ingresa una reserva de origen teléfono, WhatsApp o administración
- **THEN** el sistema no ofrece indicar el valor por noche y lo resuelve desde la tarifa vigente por ocupación

### Requirement: Auditoría administrativa

El sistema SHALL registrar actor, fecha y cambio para operaciones sensibles sobre reservas, pagos, bloqueos y sincronización manual. El cambio de estadía de una reserva SHALL constar entre esas operaciones, registrando la diferencia de fechas, de habitaciones y de cantidad de personas por habitación. El cambio del valor por noche de una habitación y la corrección del origen de una reserva SHALL constar también entre esas operaciones.

#### Scenario: Cancelación administrativa
- **WHEN** un administrador cancela una reserva
- **THEN** el sistema conserva un evento de auditoría con el estado anterior, el nuevo estado y el responsable

#### Scenario: Cancelación administrativa con pagos asociados
- **WHEN** un administrador cancela una reserva que tiene uno o más pagos asociados
- **THEN** el sistema conserva, además del evento de auditoría de la reserva, un evento de auditoría por cada pago cancelado automáticamente, con su estado anterior, su nuevo estado (`cancelled`) y el responsable

#### Scenario: Cambio de estadía de una reserva
- **WHEN** un administrador confirma una edición de estadía que cambia fechas, habitaciones o cantidad de personas por habitación
- **THEN** el sistema conserva un único evento de auditoría que identifica al responsable, las fechas anteriores y nuevas, las habitaciones que entran y salen, y la cantidad de personas anterior y nueva por habitación

#### Scenario: Cambio del valor por noche
- **WHEN** un administrador fija, modifica o descarta el valor por noche de una habitación de una reserva
- **THEN** el sistema conserva un evento de auditoría con el responsable, la habitación afectada, el valor anterior y el nuevo, y los totales anterior y nuevo

#### Scenario: Corrección del origen de una reserva
- **WHEN** un administrador corrige el origen de una reserva
- **THEN** el sistema conserva un evento de auditoría con el responsable, el origen anterior y el nuevo, y los valores y totales anterior y nuevo cuando la corrección haya soltado un valor fijado a mano

## ADDED Requirements

### Requirement: Corrección del origen en el detalle administrativo

El sistema SHALL ofrecer, en el detalle administrativo de toda reserva, la corrección de su origen a cualquiera de los seis orígenes del sistema, y SHALL aplicarla sin requerir que el administrador vuelva a crear la reserva. El sistema SHALL advertir, antes de confirmar, cuando la corrección vaya a descartar un valor por noche fijado a mano y, por lo tanto, a recalcular el total y los pagos.

#### Scenario: Corrección disponible en cualquier reserva
- **WHEN** el administrador abre el detalle de una reserva de cualquier origen
- **THEN** el sistema ofrece corregir el origen, con el origen actual seleccionado y los otros cinco disponibles

#### Scenario: Advertencia al soltar un valor fijado a mano
- **WHEN** el administrador elige un origen que no es Airbnb ni Booking en una reserva con valor por noche fijado a mano
- **THEN** el sistema advierte que el valor volverá a la tarifa vigente y que el total y los pagos se recalcularán

#### Scenario: Sin advertencia cuando nada financiero cambia
- **WHEN** el administrador elige otro origen en una reserva cuyas habitaciones usan la tarifa vigente
- **THEN** el sistema no advierte ningún recálculo, porque no habrá ninguno
