## ADDED Requirements

### Requirement: Reservas manuales con valor por noche según el origen

El sistema SHALL permitir crear reservas manuales indicando como origen Airbnb, Booking, teléfono, WhatsApp o administración, aplicando las mismas validaciones de disponibilidad que una reserva web. Cuando el origen indicado sea Airbnb, Booking o WhatsApp, el sistema SHALL permitir además indicar el valor por noche de cada habitación, y SHALL resolverlo desde la tarifa vigente por ocupación cuando el administrador no lo indique. Cuando el origen sea teléfono o administración, el sistema SHALL NOT ofrecer ese campo y SHALL resolver siempre el valor desde la tarifa vigente.

#### Scenario: Ingreso de reserva de Booking

- **WHEN** el administrador ingresa una reserva de Booking para una habitación disponible
- **THEN** el sistema la confirma y bloquea esas fechas para nuevas reservas web

#### Scenario: Reserva externa superpuesta

- **WHEN** el administrador intenta ingresar una reserva externa que se superpone con otra ocupación
- **THEN** el sistema rechaza la creación y muestra el conflicto existente

#### Scenario: Ingreso de reserva externa con valor propio del canal

- **WHEN** el administrador ingresa una reserva de Airbnb o Booking indicando un valor por noche distinto de la tarifa vigente
- **THEN** el sistema la confirma con ese valor, calcula el total a partir de él y deja registrado que el valor fue fijado a mano

#### Scenario: Ingreso de reserva de WhatsApp con valor acordado

- **WHEN** el administrador ingresa una reserva de WhatsApp indicando el valor por noche acordado con el huésped
- **THEN** el sistema la confirma con ese valor, calcula el total a partir de él y deja registrado que el valor fue fijado a mano

#### Scenario: Ingreso de reserva de teléfono o administración

- **WHEN** el administrador ingresa una reserva de origen teléfono o administración
- **THEN** el sistema no ofrece indicar el valor por noche y lo resuelve desde la tarifa vigente por ocupación

## MODIFIED Requirements

### Requirement: Corrección del origen en el detalle administrativo

El sistema SHALL ofrecer, en el detalle administrativo de toda reserva, la corrección de su origen a cualquiera de los seis orígenes del sistema, y SHALL aplicarla sin requerir que el administrador vuelva a crear la reserva. El sistema SHALL advertir, antes de confirmar, cuando la corrección vaya a descartar un valor por noche fijado a mano y, por lo tanto, a recalcular el total y los pagos.

#### Scenario: Corrección disponible en cualquier reserva
- **WHEN** el administrador abre el detalle de una reserva de cualquier origen
- **THEN** el sistema ofrece corregir el origen, con el origen actual seleccionado y los otros cinco disponibles

#### Scenario: Advertencia al soltar un valor fijado a mano
- **WHEN** el administrador elige un origen que no admite un valor por noche propio —sitio web, teléfono o administración— en una reserva con valor por noche fijado a mano
- **THEN** el sistema advierte que el valor volverá a la tarifa vigente y que el total y los pagos se recalcularán

#### Scenario: Sin advertencia al corregir entre orígenes que admiten valor propio
- **WHEN** el administrador elige Airbnb, Booking o WhatsApp en una reserva con valor por noche fijado a mano
- **THEN** el sistema no advierte ningún recálculo, porque el valor fijado a mano se conserva

#### Scenario: Sin advertencia cuando nada financiero cambia
- **WHEN** el administrador elige otro origen en una reserva cuyas habitaciones usan la tarifa vigente
- **THEN** el sistema no advierte ningún recálculo, porque no habrá ninguno

## REMOVED Requirements

### Requirement: Reservas manuales multicanal

**Reason**: Reemplazado por "Reservas manuales con valor por noche según el origen", que incorpora WhatsApp al conjunto de orígenes que admiten indicar el valor por noche al crear la reserva.

**Migration**: Ninguna. La creación manual sigue aceptando los mismos cinco orígenes con las mismas validaciones de disponibilidad; solo cambia qué orígenes ofrecen el campo de valor por noche.
