# availability-search-experience Specification

## Purpose

Proporcionar una experiencia pública clara y accesible para iniciar una consulta, revisar habitaciones disponibles con datos mock y conservar los criterios durante la navegación.

## Requirements

### Requirement: Buscador integrado visualmente al hero
La página de inicio SHALL presentar el buscador de disponibilidad como una tarjeta elevada que se integra visualmente con el borde inferior del hero, usando las superficies, tipografía, radios, sombras, separadores e iconografía coherentes con la identidad de Vista Valle.

#### Scenario: Composición en escritorio
- **WHEN** el visitante abre la página de inicio en una pantalla amplia
- **THEN** el buscador aparece superpuesto al borde inferior del hero en una composición horizontal con fecha de entrada, fecha de salida, huéspedes y “Consultar disponibilidad” claramente diferenciados

#### Scenario: Campos reconocibles
- **WHEN** el visitante revisa el buscador
- **THEN** cada campo conserva un label visible, un control táctil identificable y, cuando corresponda, un icono contextual de calendario o huésped sin depender del icono para comunicar su significado

#### Scenario: Acción principal visible
- **WHEN** el visitante completa o revisa los criterios de búsqueda
- **THEN** la acción “Consultar disponibilidad” mantiene una jerarquía visual primaria, contraste suficiente y un estado ocupado visible durante la navegación

### Requirement: Presentación responsive del buscador integrado
El buscador SHALL conservar su integración con el hero y su legibilidad al cambiar de viewport, reorganizando sus controles sin overflow horizontal, solapamientos ni pérdida de información.

#### Scenario: Composición móvil
- **WHEN** el visitante abre la página en una pantalla de 320 píxeles o más estrecha
- **THEN** la tarjeta se adapta a una disposición vertical o compacta, mantiene todos los labels y controles operables y no requiere desplazamiento horizontal

#### Scenario: Composición intermedia
- **WHEN** el visitante usa una pantalla tablet
- **THEN** los campos se distribuyen en una composición equilibrada que mantiene la tarjeta visualmente conectada al hero y evita que la acción principal quede escondida

#### Scenario: Preferencias de movimiento y contraste
- **WHEN** el visitante solicita movimiento reducido o utiliza contraste aumentado del sistema
- **THEN** la presentación evita animaciones no esenciales y conserva estados, bordes, foco y texto distinguibles

### Requirement: Inicio de búsqueda hacia una página dedicada
El sistema SHALL permitir que un visitante seleccione fecha de entrada, fecha de salida y cantidad de huéspedes desde el buscador ubicado bajo el hero y, cuando los criterios sean válidos, SHALL navegar a una página pública dedicada de disponibilidad.

#### Scenario: Búsqueda válida desde la página de inicio
- **WHEN** el visitante completa fechas válidas, indica una cantidad válida de huéspedes y activa “Consultar disponibilidad”
- **THEN** el sistema inicia la navegación a la página de disponibilidad y representa entrada, salida y huéspedes en su URL

#### Scenario: Búsqueda inválida desde la página de inicio
- **WHEN** el visitante intenta buscar con fechas ausentes, inválidas o no ordenadas, o con una cantidad de huéspedes fuera de los límites permitidos
- **THEN** el sistema permanece en la página de inicio, identifica los campos que deben corregirse y no ejecuta la consulta

#### Scenario: Contexto de habitación preseleccionada
- **WHEN** la búsqueda fue iniciada desde el detalle de una habitación
- **THEN** el sistema conserva de forma explícita el identificador público de esa habitación junto con los demás criterios de búsqueda

### Requirement: Feedback de carga continuo
El sistema SHALL proporcionar feedback visual y accesible desde la activación de una búsqueda válida hasta que los resultados o un estado recuperable estén disponibles, SHALL impedir envíos duplicados durante la operación y MUST NOT introducir una espera artificial.

#### Scenario: Transición inicial a resultados
- **WHEN** el visitante activa una búsqueda válida desde la página de inicio
- **THEN** el control de envío cambia inmediatamente a estado ocupado y la navegación presenta un estado general de carga con estructura estable

#### Scenario: Actualización de criterios en resultados
- **WHEN** el visitante ejecuta una nueva búsqueda desde la página de disponibilidad
- **THEN** el sistema mantiene visible el contexto de búsqueda, marca la región de resultados como ocupada y presenta placeholders estables hasta resolver la nueva consulta

#### Scenario: Preferencia de movimiento reducido
- **WHEN** el visitante ha solicitado reducir el movimiento
- **THEN** el feedback de carga comunica progreso sin animaciones no esenciales

### Requirement: Buscador persistente en resultados
La página de disponibilidad SHALL presentar en su parte superior el mismo conjunto de criterios de búsqueda, precargado desde la URL y editable para realizar una nueva consulta sin regresar a la página de inicio.

#### Scenario: Apertura de un enlace de resultados
- **WHEN** el visitante abre directamente una URL de disponibilidad con criterios válidos
- **THEN** el sistema presenta el buscador con esos valores y los resultados correspondientes

#### Scenario: Modificación de la búsqueda
- **WHEN** el visitante cambia uno o más criterios y vuelve a consultar
- **THEN** el sistema actualiza la URL y reemplaza los resultados usando los nuevos criterios válidos

#### Scenario: Navegación atrás y adelante
- **WHEN** el visitante usa el historial del navegador entre búsquedas válidas
- **THEN** el sistema restaura los criterios y resultados asociados a cada URL sin solicitar su reingreso

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

### Requirement: Aislamiento del contexto mock
El sistema SHALL obtener disponibilidad, contenido de habitaciones y precios desde contratos y fixtures deterministas bajo el contexto `mock`, SHALL identificar los datos comerciales ficticios como demostración y MUST NOT realizar solicitudes a PostgreSQL, Supabase, Storage ni proveedores externos para esta experiencia.

#### Scenario: Consulta en desarrollo mock
- **WHEN** un visitante completa una consulta bajo el contexto `mock`
- **THEN** el sistema responde solo con fixtures locales, identifica la información ficticia como demostración y no realiza solicitudes externas

#### Scenario: Contexto de producción sin fuente configurada
- **WHEN** la experiencia se ejecuta bajo `production` sin fuentes comerciales y de disponibilidad reales configuradas
- **THEN** el sistema falla de forma cerrada y nunca presenta los fixtures mock como disponibilidad real

### Requirement: Experiencia responsive, accesible y estable
La página de disponibilidad SHALL ser utilizable desde 320 píxeles hasta escritorio, SHALL mantener el buscador integrado al contexto visual del hero en la página de inicio y compacto en la parte superior de resultados, SHALL mantener orden semántico, labels visibles, foco identificable, controles táctiles accesibles, anuncios comprensibles para tecnologías de asistencia y espacio reservado para imágenes y contenido asíncrono.

#### Scenario: Resultados en pantalla móvil
- **WHEN** el visitante consulta desde una pantalla móvil
- **THEN** el buscador y las habitaciones se presentan en una sola columna sin desplazamiento horizontal ni controles superpuestos

#### Scenario: Resultados en pantalla amplia
- **WHEN** el visitante consulta desde una pantalla de tablet o escritorio
- **THEN** el buscador se presenta de forma compacta en la parte superior y las habitaciones aprovechan una grilla legible sin alterar el orden del contenido

#### Scenario: Buscador inicial en pantalla amplia
- **WHEN** el visitante abre el landing en una pantalla de tablet o escritorio
- **THEN** el buscador se presenta como una tarjeta elevada integrada al borde inferior del hero, con sus campos y acción principal alineados de forma legible

#### Scenario: Buscador de resultados en pantalla amplia
- **WHEN** el visitante consulta desde una pantalla de tablet o escritorio
- **THEN** el buscador de la página de disponibilidad se presenta de forma compacta en la parte superior y las habitaciones aprovechan una grilla legible sin alterar el orden del contenido

#### Scenario: Consulta mediante teclado y lector de pantalla
- **WHEN** el visitante navega, modifica criterios y revisa resultados sin ratón
- **THEN** puede operar todos los controles, identificar el estado ocupado y recibir el resultado de la consulta sin que el foco quede oculto o se desplace de forma inesperada

### Requirement: URLs de resultados no indexables
El sistema SHALL permitir compartir y restaurar URLs de disponibilidad, pero SHALL evitar que combinaciones de fechas y huéspedes generen páginas indexables duplicadas.

#### Scenario: Rastreo de una búsqueda parametrizada
- **WHEN** un buscador accede a una URL de disponibilidad con criterios
- **THEN** recibe instrucciones para no indexar esa página de resultados y una referencia canónica que no incorpora los parámetros de búsqueda

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
