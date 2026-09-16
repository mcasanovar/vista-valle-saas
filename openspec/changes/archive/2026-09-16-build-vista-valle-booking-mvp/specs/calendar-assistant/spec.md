## Purpose

Permitir que el administrador prepare bloqueos de disponibilidad escribiendo instrucciones naturales en español, manteniendo validación determinista y confirmación humana antes de modificar el calendario. En este MVP, el chat usa una única respuesta mock y determinista; la integración con un proveedor de IA se difiere a un cambio OpenSpec posterior.

## ADDED Requirements

### Requirement: Interpretación restringida de cierres
El sistema SHALL interpretar lenguaje natural exclusivamente como propuestas para crear bloqueos de habitación y SHALL producir habitación, fecha inicial, fecha final y motivo en una estructura validada.

#### Scenario: Respuesta mock del MVP
- **WHEN** el administrador envía una instrucción compatible en el chat del asistente bajo el contexto mock
- **THEN** el sistema presenta la única respuesta estructurada determinista configurada, sin realizar solicitudes a proveedores de IA ni requerir credenciales

#### Scenario: Cierre de una noche
- **WHEN** el administrador escribe "bloquea la habitación 1 el 5 de mayo"
- **THEN** el asistente propone un bloqueo de una noche para esa habitación y presenta las fechas absolutas interpretadas

#### Scenario: Acción fuera de alcance
- **WHEN** el administrador solicita cancelar una reserva, cambiar precios o ejecutar otra acción no soportada
- **THEN** el asistente rechaza la acción y explica que solo puede proponer cierres de fechas

### Requirement: Resolución de ambigüedades
El sistema SHALL solicitar información adicional cuando la habitación, el intervalo o el año no puedan resolverse con seguridad y SHALL mostrar cualquier inferencia temporal antes de continuar.

#### Scenario: Habitación omitida
- **WHEN** el administrador escribe "cierra la habitación para el viernes"
- **THEN** el asistente pregunta qué habitación debe cerrar y no crea un bloqueo

#### Scenario: Fecha sin año
- **WHEN** el administrador indica día y mes sin año
- **THEN** el asistente propone una fecha futura usando `America/Santiago` y exige confirmación explícita de la fecha absoluta

### Requirement: Vista previa y aprobación humana
El sistema MUST presentar habitación, intervalo, noches y motivo interpretados y MUST requerir una confirmación explícita antes de ejecutar la operación.

#### Scenario: Propuesta sin confirmar
- **WHEN** la IA devuelve una interpretación válida
- **THEN** el calendario permanece sin cambios hasta que el administrador confirma la vista previa

### Requirement: Validación determinista
El sistema MUST resolver la habitación contra datos reales y aplicar las reglas normales de fechas, autorización y conflictos después de la interpretación de IA.

#### Scenario: Habitación inventada
- **WHEN** la salida del modelo contiene una habitación inexistente
- **THEN** el sistema rechaza la propuesta y no ejecuta ninguna modificación

#### Scenario: Reserva existente
- **WHEN** el bloqueo confirmado se superpone con una reserva o retención incompatible
- **THEN** el sistema no crea el bloqueo y muestra el conflicto al administrador

### Requirement: Sin acceso directo de la IA
El sistema MUST impedir que el modelo ejecute SQL, invoque operaciones arbitrarias o modifique disponibilidad directamente.

#### Scenario: Salida no válida
- **WHEN** el modelo devuelve texto o parámetros que no cumplen el esquema permitido
- **THEN** el sistema trata la interpretación como fallida y no ejecuta acciones

### Requirement: Auditoría del asistente
El sistema SHALL conservar la instrucción original, interpretación, correcciones, confirmación, actor y resultado de cada operación ejecutada mediante el asistente.

#### Scenario: Bloqueo confirmado
- **WHEN** el administrador confirma una propuesta y el bloqueo se crea
- **THEN** el detalle del bloqueo identifica que fue iniciado mediante el asistente y conserva su trazabilidad

### Requirement: Alternativa manual
El sistema SHALL mantener disponible el formulario normal de creación de bloqueos cuando el asistente no esté disponible o no comprenda una instrucción.

#### Scenario: Proveedor de IA no disponible
- **WHEN** el servicio de IA devuelve un error o excede el tiempo de respuesta
- **THEN** el panel informa el fallo sin modificar datos y ofrece crear el bloqueo manualmente
