## REMOVED Requirements

### Requirement: Interpretación restringida de cierres
**Reason**: El asistente deja de estar limitado a proponer bloqueos de habitación y deja de operar con una respuesta mock determinista. La restricción de alcance y el comportamiento mock del MVP ya no describen el sistema.
**Migration**: El alcance de interpretación, el rechazo de acciones fuera de alcance y la estructura validada de cada propuesta quedan cubiertos por `admin-assistant-operations`, que define la superficie completa de operaciones —disponibilidad, reservas, pagos y bloqueos— y la propuesta obligatoria para toda escritura. La interpretación pasa a resolverse con un proveedor de IA real detrás de un adaptador tipado, según `admin-ai-assistant`.

## MODIFIED Requirements

### Requirement: Resolución de ambigüedades
El sistema SHALL solicitar información adicional cuando la operación, la entidad afectada, el intervalo o el año no puedan resolverse con seguridad, y SHALL mostrar cualquier inferencia temporal en términos absolutos antes de continuar.

#### Scenario: Habitación omitida
- **WHEN** el administrador escribe "cierra la habitación para el viernes"
- **THEN** el asistente pregunta qué habitación debe cerrar y no crea un bloqueo

#### Scenario: Fecha sin año
- **WHEN** el administrador indica día y mes sin año
- **THEN** el asistente propone una fecha futura usando `America/Santiago` y exige confirmación explícita de la fecha absoluta

#### Scenario: Reserva referida de forma ambigua
- **WHEN** la instrucción hace referencia a una reserva y más de una coincide con el criterio entregado
- **THEN** el asistente presenta las coincidencias, pide al administrador que elija y no genera una propuesta

#### Scenario: Operación ambigua
- **WHEN** la instrucción admite más de una operación posible sobre la misma entidad
- **THEN** el asistente pregunta cuál corresponde y no ejecuta ni propone ninguna

### Requirement: Vista previa y aprobación humana
El sistema MUST presentar la operación interpretada, la entidad afectada y todos sus valores en términos absolutos, y MUST requerir una confirmación explícita antes de ejecutar cualquier operación de escritura.

#### Scenario: Propuesta sin confirmar
- **WHEN** la IA devuelve una interpretación válida
- **THEN** los datos del sistema permanecen sin cambios hasta que el administrador confirma la vista previa

#### Scenario: Vista previa de una operación sobre reservas
- **WHEN** la propuesta afecta a una reserva
- **THEN** la vista previa identifica la reserva, su huésped, su habitación, su intervalo, su estado vigente y su estado de pago antes de pedir confirmación

### Requirement: Validación determinista
El sistema MUST resolver toda entidad referida por el modelo contra datos reales y MUST aplicar las reglas normales de fechas, capacidad, autorización, transiciones de estado y conflictos después de la interpretación de IA, en el momento de la confirmación.

#### Scenario: Habitación inventada
- **WHEN** la salida del modelo contiene una habitación inexistente
- **THEN** el sistema rechaza la propuesta y no ejecuta ninguna modificación

#### Scenario: Reserva existente
- **WHEN** el bloqueo confirmado se superpone con una reserva o retención incompatible
- **THEN** el sistema no crea el bloqueo y muestra el conflicto al administrador

#### Scenario: Estado cambiado entre la propuesta y la confirmación
- **WHEN** la entidad afectada cambia de estado entre la generación de la propuesta y su confirmación
- **THEN** el sistema revalida contra el estado vigente y rechaza la operación si dejó de ser válida

### Requirement: Auditoría del asistente
El sistema SHALL conservar de forma duradera la instrucción original, interpretación, correcciones, confirmación, actor y resultado de cada operación ejecutada mediante el asistente, cualquiera sea la operación.

#### Scenario: Bloqueo confirmado
- **WHEN** el administrador confirma una propuesta y el bloqueo se crea
- **THEN** el detalle del bloqueo identifica que fue iniciado mediante el asistente y conserva su trazabilidad

#### Scenario: Operación sobre una reserva confirmada
- **WHEN** el administrador confirma una propuesta que crea o modifica una reserva o registra un cobro
- **THEN** el registro de esa interacción queda conservado e identifica la reserva o el pago afectado

### Requirement: Alternativa manual
El sistema SHALL mantener plenamente disponibles las pantallas y formularios normales de administración cuando el asistente no esté disponible o no comprenda una instrucción.

#### Scenario: Proveedor de IA no disponible
- **WHEN** el servicio de IA devuelve un error o excede el tiempo de respuesta
- **THEN** el panel informa el fallo sin modificar datos y ofrece realizar la operación en su pantalla correspondiente

#### Scenario: Instrucción no comprendida
- **WHEN** el asistente no logra interpretar una instrucción con seguridad
- **THEN** no ejecuta ni propone nada y el administrador conserva la vía manual intacta para esa operación
