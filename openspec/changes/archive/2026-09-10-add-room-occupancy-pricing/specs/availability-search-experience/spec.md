## MODIFIED Requirements

### Requirement: Presentación de habitaciones disponibles
El sistema SHALL mostrar todas las habitaciones publicables cuya disponibilidad satisfaga la consulta autoritativa (fechas), sin descartar una habitación por no tener capacidad para alojar por sí sola a la totalidad de huéspedes buscados, y SHALL presentar cada resultado con imagen, nombre, capacidad, configuración de camas, baño cuando esté configurado, servicios configurados, un control para elegir la ocupación (1 o 2 personas) cuando la habitación admita más de un huésped, el precio correspondiente a la ocupación elegida (o al precio más bajo disponible cuando aún no se ha elegido) y una acción para continuar.

#### Scenario: Resultados disponibles
- **WHEN** una o más habitaciones satisfacen fechas y están disponibles para la búsqueda
- **THEN** la página muestra un resumen de la consulta, la cantidad de resultados y una colección visual de esas habitaciones, incluidas aquellas cuya capacidad es menor a la cantidad total de huéspedes buscada

#### Scenario: Continuación desde una habitación disponible
- **WHEN** el visitante activa la acción principal de una habitación resultante
- **THEN** el sistema abre su detalle conservando fechas, huéspedes y el contexto de que la habitación fue seleccionada desde disponibilidad

#### Scenario: Habitación preseleccionada disponible
- **WHEN** la consulta contiene una habitación preseleccionada que sigue disponible para las fechas
- **THEN** el sistema presenta esa habitación como resultado y conserva los criterios para continuar, sin exigir que su capacidad cubra la totalidad de huéspedes buscados

### Requirement: Estados recuperables de ausencia y error
La página de disponibilidad SHALL mantener accesible el buscador y los criterios consultados cuando no existan resultados, cuando una habitación preseleccionada no esté disponible o cuando la consulta falle, SHALL ofrecer una acción de recuperación aplicable sin inventar disponibilidad y SHALL comunicar toda validación o error visible al visitante en español claro sin exponer textos técnicos.

#### Scenario: Sin habitaciones disponibles
- **WHEN** ninguna habitación satisface las fechas de la búsqueda
- **THEN** el sistema explica que no hay disponibilidad y permite ajustar fechas o huéspedes desde el buscador visible

#### Scenario: Habitación preseleccionada no disponible
- **WHEN** la habitación preseleccionada no está disponible para las fechas de la búsqueda
- **THEN** el sistema identifica esa condición y permite modificar la búsqueda o retirar la preselección sin presentar la habitación como disponible

#### Scenario: Fallo de consulta
- **WHEN** la fuente de disponibilidad devuelve un error inesperado
- **THEN** el sistema conserva los criterios, comunica el fallo sin datos sensibles y en español, y ofrece reintentar la misma consulta

#### Scenario: URL incompleta o inválida
- **WHEN** el visitante abre la página de disponibilidad sin todos los criterios válidos
- **THEN** el sistema presenta el buscador con errores específicos en español y no muestra resultados como si fueran válidos

## ADDED Requirements

### Requirement: Selector de ocupación por resultado
El sistema SHALL permitir, para cada habitación resultante con capacidad mayor a 1, elegir entre 1 o 2 personas antes de agregarla a la reserva, y SHALL actualizar de inmediato el precio mostrado para esa habitación según la ocupación elegida. Una habitación con capacidad 1 SHALL NOT presentar este control.

#### Scenario: Cambiar la ocupación de un resultado
- **WHEN** el visitante cambia la ocupación seleccionada de una habitación resultante entre 1 y 2 personas
- **THEN** el sistema actualiza inmediatamente el precio mostrado de esa habitación sin recargar la página

#### Scenario: Habitación de una sola plaza
- **WHEN** un resultado corresponde a una habitación con capacidad 1
- **THEN** el sistema no presenta el selector de ocupación y muestra un único precio

### Requirement: Reparto de huéspedes entre habitaciones seleccionadas
El sistema SHALL sumar los huéspedes asignados a través de todas las habitaciones que el visitante ha agregado a la reserva para la misma búsqueda, SHALL impedir elegir una ocupación o agregar una habitación cuando esa suma superaría la cantidad de huéspedes buscada, y SHALL comunicar de forma clara y concisa cuántos huéspedes ya están asignados frente al total buscado. La ocupación elegida para una habitación SHALL NOT alterar el bloqueo de disponibilidad de esa habitación para otros visitantes: una habitación agregada queda igual de ocupada para las fechas de la reserva sin importar si se le asignó 1 o 2 personas.

#### Scenario: Reparto completo con una habitación
- **WHEN** el visitante agrega una habitación cuya ocupación elegida cubre la totalidad de los huéspedes buscados
- **THEN** el sistema marca el reparto como completo y no permite agregar más habitaciones a esa búsqueda

#### Scenario: Reparto entre dos habitaciones
- **WHEN** el visitante agrega una habitación con una ocupación menor a los huéspedes buscados
- **THEN** el sistema mantiene disponibles las demás habitaciones cuya ocupación no exceda los huéspedes restantes, y bloquea las opciones u habitaciones que sí lo harían

#### Scenario: Mensaje de reparto pendiente
- **WHEN** el visitante aún no ha asignado la totalidad de los huéspedes buscados entre las habitaciones agregadas
- **THEN** el sistema muestra un mensaje claro y conciso indicando cuántos huéspedes faltan por asignar
