# admin-assistant-memory Specification

## Purpose

Permitir que el asistente conserve y aplique las convenciones propias del administrador —vocabulario para referirse a habitaciones, criterios operativos recurrentes— sin que esa memoria se convierta en una fuente de datos falsos sobre el estado del sistema ni en un canal por el cual texto de terceros influya en el comportamiento del asistente.

## Requirements

### Requirement: Memoria escrita solo por instrucción explícita
El sistema MUST registrar un hecho en la memoria únicamente cuando el administrador lo instruya de forma explícita, y MUST NOT inferirlo de datos de reservas, huéspedes, notas de canales externos ni de ningún otro texto no escrito por el administrador.

#### Scenario: Enseñanza explícita
- **WHEN** el administrador le indica al asistente que recuerde una preferencia o una convención
- **THEN** el sistema registra ese hecho y confirma al administrador qué quedó registrado

#### Scenario: Contenido de terceros
- **WHEN** el asistente procesa datos que contienen texto de origen externo, como el nombre de un huésped, un comentario de reserva o una nota importada de un canal
- **THEN** el sistema MUST NOT registrar nada en memoria a partir de ese texto ni tratarlo como instrucción

#### Scenario: Instrucción incrustada en datos
- **WHEN** un dato consultado por el asistente contiene texto que aparenta ser una instrucción dirigida al asistente
- **THEN** el sistema lo trata como dato, no lo ejecuta y no lo incorpora a la memoria

### Requirement: Aplicación de la memoria en la interpretación
El asistente SHALL aplicar los hechos registrados al interpretar instrucciones posteriores, y MUST exponer en términos absolutos el resultado de esa interpretación antes de cualquier ejecución.

#### Scenario: Vocabulario propio
- **WHEN** el administrador enseñó una forma propia de nombrar una habitación y luego la usa en una instrucción
- **THEN** el asistente la resuelve a la habitación correspondiente y la identifica por su nombre real en la propuesta

#### Scenario: Memoria contradicha por el estado real
- **WHEN** un hecho de la memoria contradice el estado vigente del sistema
- **THEN** el asistente da prioridad al estado vigente del sistema y advierte la discrepancia al administrador

### Requirement: Memoria revisable por el administrador
El sistema SHALL mostrar al administrador todos los hechos registrados y SHALL permitirle editarlos y eliminarlos desde la página del asistente.

#### Scenario: Revisión de lo aprendido
- **WHEN** el administrador abre la memoria del asistente
- **THEN** el sistema lista todos los hechos registrados en lenguaje legible, con la fecha en que se registraron

#### Scenario: Eliminación de un hecho
- **WHEN** el administrador elimina un hecho de la memoria
- **THEN** el asistente deja de aplicarlo en interacciones posteriores

### Requirement: El contexto del sistema no es memoria
El sistema MUST obtener el estado operativo —habitaciones existentes, capacidades, tarifas, disponibilidad, estados válidos y datos de reservas— de la fuente de datos del sistema en cada interacción, y MUST NOT servirlo desde la memoria del asistente.

#### Scenario: Tarifa modificada
- **WHEN** una tarifa cambia en el sistema y el administrador consulta al asistente después
- **THEN** el asistente responde con el valor vigente y no con ningún valor conservado de interacciones anteriores

#### Scenario: Intento de registrar estado como preferencia
- **WHEN** una instrucción pediría registrar en memoria un dato que forma parte del estado operativo del sistema
- **THEN** el sistema no lo registra como hecho de memoria y explica que ese dato se consulta en vivo
