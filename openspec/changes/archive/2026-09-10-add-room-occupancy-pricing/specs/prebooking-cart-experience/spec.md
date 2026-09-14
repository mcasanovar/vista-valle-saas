## MODIFIED Requirements

### Requirement: Página de pre-reserva
El sistema SHALL proporcionar la ruta pública `/pre-reserva` para revisar antes de confirmar las habitaciones seleccionadas, la cantidad de personas asignada a cada una, fechas compartidas, noches, subtotales, total, datos del titular y la solicitud opcional de factura.

#### Scenario: Revisión antes de confirmar
- **WHEN** el huésped selecciona el acceso del carro
- **THEN** llega a `/pre-reserva` y puede revisar o quitar habitaciones antes de confirmar la reserva

#### Scenario: Factura en pre-reserva
- **WHEN** el huésped activa solicitar factura en la pre-reserva
- **THEN** el sistema muestra y exige los antecedentes tributarios definidos para la solicitud antes de permitir confirmar

#### Scenario: Fechas informativas en pre-reserva
- **WHEN** el huésped abre una pre-reserva con fechas válidas
- **THEN** el sistema presenta entrada y salida como un resumen de solo lectura
- **AND** no muestra una acción para actualizar ni editar fechas desde esta página
- **AND** la búsqueda de un rango distinto continúa desde la página inicial

### Requirement: Detalle desplegable integrado del carro
El sistema SHALL permitir activar el resumen de ítems del carro para que el mismo componente se expanda únicamente hacia arriba y revele su detalle integrado. El área desplegada SHALL mostrar, por cada habitación seleccionada, su nombre, la cantidad de personas asignadas, cantidad de noches, valor por noche para esa ocupación y una acción de eliminación; su altura SHALL depender del contenido real de las habitaciones seleccionadas y SHALL volver al estado compacto al activar fuera del carro, usar Escape o cambiar la selección. Las zonas ya visibles del carro SHALL permanecer centradas y visualmente equilibradas mientras el componente cambia de altura.

#### Scenario: Abrir el detalle de ítems
- **WHEN** el huésped activa el resumen de ítems agregados del carro
- **THEN** el mismo carro revela hacia arriba solo el espacio necesario para la lista integrada de detalles de sus habitaciones

#### Scenario: Indicador de detalle disponible
- **WHEN** el carro contiene habitaciones seleccionadas
- **THEN** el resumen de ítems muestra un indicador visible de que puede activarse para ver el detalle
- **AND** el indicador comunica visualmente si el detalle está expandido o compacto sin depender solo del color

#### Scenario: Cerrar el detalle de ítems
- **WHEN** el detalle desplegable está abierto y el huésped activa fuera del carro o presiona Escape
- **THEN** el panel se cierra y el carro vuelve suavemente a su altura compacta

#### Scenario: Quitar una habitación desde el carro
- **WHEN** el huésped activa la acción de eliminación de una habitación en el detalle del carro
- **THEN** el sistema retira inmediatamente esa habitación de la selección, actualiza el contador y el subtotal autoritativo representado en el carro
- **AND** la acción tiene un nombre accesible que identifica la habitación, además de su icono visual

#### Scenario: Quitar la última habitación desde el carro
- **WHEN** el huésped retira la única habitación seleccionada desde el detalle del carro
- **THEN** el carro desaparece y la interfaz restaura el estado sin selección

## ADDED Requirements

### Requirement: Selección de ocupación conservada en el carro
El sistema SHALL asociar a cada habitación seleccionada en el carro la cantidad de personas (1 o 2) elegida al momento de agregarla, SHALL conservar ese dato junto con la selección persistente de habitaciones y fechas, y SHALL recalcular el subtotal de esa línea y el total del carro si la ocupación de una habitación cambia antes de confirmar la reserva.

#### Scenario: Persistencia de la ocupación elegida
- **WHEN** el huésped agrega una habitación con una ocupación elegida y navega entre landing, resultados, detalle y pre-reserva
- **THEN** el carro conserva esa misma cantidad de personas para esa habitación hasta que el huésped la quite o la modifique

#### Scenario: Cambio de ocupación antes de confirmar
- **WHEN** el huésped cambia la ocupación de una habitación ya agregada al carro
- **THEN** el sistema recalcula de inmediato el subtotal de esa línea y el total del carro con el precio correspondiente a la nueva ocupación
