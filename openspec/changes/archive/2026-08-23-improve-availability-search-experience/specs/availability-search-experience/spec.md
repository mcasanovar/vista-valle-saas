## Purpose

Proporcionar una experiencia pública clara y accesible para iniciar una consulta, revisar habitaciones disponibles con datos mock y conservar los criterios durante la navegación.

## ADDED Requirements

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
El sistema SHALL mostrar únicamente habitaciones publicables cuya capacidad y disponibilidad satisfagan la consulta autoritativa, y SHALL presentar cada resultado con imagen, nombre, capacidad, configuración de camas, baño cuando esté configurado, servicios configurados, precio base por noche y una acción para continuar.

#### Scenario: Resultados disponibles
- **WHEN** una o más habitaciones satisfacen fechas y cantidad de huéspedes
- **THEN** la página muestra un resumen de la consulta, la cantidad de resultados y una colección visual de esas habitaciones

#### Scenario: Continuación desde una habitación disponible
- **WHEN** el visitante activa la acción principal de una habitación resultante
- **THEN** el sistema abre su detalle conservando fechas, huéspedes y el contexto de que la habitación fue seleccionada desde disponibilidad

#### Scenario: Habitación preseleccionada disponible
- **WHEN** la consulta contiene una habitación preseleccionada que sigue disponible y admite la cantidad de huéspedes
- **THEN** el sistema presenta esa habitación como resultado y conserva los criterios para continuar

### Requirement: Estados recuperables de ausencia y error
La página de disponibilidad SHALL mantener accesible el buscador y los criterios consultados cuando no existan resultados, cuando una habitación preseleccionada no esté disponible o cuando la consulta falle, y SHALL ofrecer una acción de recuperación aplicable sin inventar disponibilidad.

#### Scenario: Sin habitaciones disponibles
- **WHEN** ninguna habitación satisface las fechas y la cantidad de huéspedes
- **THEN** el sistema explica que no hay disponibilidad y permite ajustar fechas o huéspedes desde el buscador visible

#### Scenario: Habitación preseleccionada no disponible
- **WHEN** la habitación preseleccionada no está disponible o no admite la cantidad indicada
- **THEN** el sistema identifica esa condición y permite modificar la búsqueda o retirar la preselección sin presentar la habitación como disponible

#### Scenario: Fallo de consulta
- **WHEN** la fuente de disponibilidad devuelve un error inesperado
- **THEN** el sistema conserva los criterios, comunica el fallo sin datos sensibles y ofrece reintentar la misma consulta

#### Scenario: URL incompleta o inválida
- **WHEN** el visitante abre la página de disponibilidad sin todos los criterios válidos
- **THEN** el sistema presenta el buscador con errores específicos y no muestra resultados como si fueran válidos

### Requirement: Aislamiento del contexto mock
El sistema SHALL obtener disponibilidad, contenido de habitaciones y precios desde contratos y fixtures deterministas bajo el contexto `mock`, SHALL identificar los datos comerciales ficticios como demostración y MUST NOT realizar solicitudes a PostgreSQL, Supabase, Storage ni proveedores externos para esta experiencia.

#### Scenario: Consulta en desarrollo mock
- **WHEN** un visitante completa una consulta bajo el contexto `mock`
- **THEN** el sistema responde solo con fixtures locales, identifica la información ficticia como demostración y no realiza solicitudes externas

#### Scenario: Contexto de producción sin fuente configurada
- **WHEN** la experiencia se ejecuta bajo `production` sin fuentes comerciales y de disponibilidad reales configuradas
- **THEN** el sistema falla de forma cerrada y nunca presenta los fixtures mock como disponibilidad real

### Requirement: Experiencia responsive, accesible y estable
La página de disponibilidad SHALL ser utilizable desde 320 píxeles hasta escritorio, SHALL mantener orden semántico, labels visibles, foco identificable, controles táctiles accesibles, anuncios comprensibles para tecnologías de asistencia y espacio reservado para imágenes y contenido asíncrono.

#### Scenario: Resultados en pantalla móvil
- **WHEN** el visitante consulta desde una pantalla móvil
- **THEN** el buscador y las habitaciones se presentan en una sola columna sin desplazamiento horizontal ni controles superpuestos

#### Scenario: Resultados en pantalla amplia
- **WHEN** el visitante consulta desde una pantalla de tablet o escritorio
- **THEN** el buscador se presenta de forma compacta en la parte superior y las habitaciones aprovechan una grilla legible sin alterar el orden del contenido

#### Scenario: Consulta mediante teclado y lector de pantalla
- **WHEN** el visitante navega, modifica criterios y revisa resultados sin ratón
- **THEN** puede operar todos los controles, identificar el estado ocupado y recibir el resultado de la consulta sin que el foco quede oculto o se desplace de forma inesperada

### Requirement: URLs de resultados no indexables
El sistema SHALL permitir compartir y restaurar URLs de disponibilidad, pero SHALL evitar que combinaciones de fechas y huéspedes generen páginas indexables duplicadas.

#### Scenario: Rastreo de una búsqueda parametrizada
- **WHEN** un buscador accede a una URL de disponibilidad con criterios
- **THEN** recibe instrucciones para no indexar esa página de resultados y una referencia canónica que no incorpora los parámetros de búsqueda
