## ADDED Requirements

### Requirement: Registro de estadías ya iniciadas o pasadas
El sistema SHALL permitir que una reserva manual creada por un administrador tenga fecha de entrada anterior a la fecha actual en `America/Santiago`, sin límite hacia atrás, y SHALL permitir que su fecha de salida también sea anterior a la fecha actual. El sistema SHALL NOT aplicar en el flujo administrativo de creación la regla de fechas vigentes que rige la consulta pública de disponibilidad. La única restricción de fechas que el sistema SHALL aplicar en este flujo es que la fecha de salida sea posterior a la fecha de entrada, verificada de forma autoritativa en el servidor antes de resolver disponibilidad y antes de confirmar. Los límites de los controles de fecha del formulario solo mejoran la guía de interfaz.

#### Scenario: Estadía en curso registrada con retraso
- **WHEN** el administrador crea una reserva manual con entrada anterior a hoy y salida posterior a hoy
- **THEN** el sistema resuelve la disponibilidad de ese intervalo y crea la reserva confirmada con las fechas indicadas, sin reportar error de fecha

#### Scenario: Estadía completamente pasada
- **WHEN** el administrador crea una reserva manual cuyas fechas de entrada y de salida son ambas anteriores a hoy
- **THEN** el sistema crea la reserva confirmada con esas fechas, sin reportar error de fecha

#### Scenario: Salida no posterior a la entrada
- **WHEN** el administrador envía una reserva manual cuya fecha de salida es igual o anterior a su fecha de entrada
- **THEN** el sistema no crea la reserva, identifica la fecha de salida como inválida y muestra un mensaje de corrección en español

#### Scenario: Conflicto de disponibilidad en fechas pasadas
- **WHEN** el administrador intenta crear una reserva manual en un intervalo pasado que se superpone con una reserva confirmada, un hold vigente o un bloqueo de la misma habitación
- **THEN** el sistema no crea ninguna parte de la reserva y comunica el conflicto, igual que en un intervalo futuro

#### Scenario: La consulta pública conserva su regla
- **WHEN** un visitante del sitio público consulta disponibilidad con una fecha de entrada anterior a hoy
- **THEN** el sistema sigue rechazando la consulta e identificando la fecha de entrada como inválida

## MODIFIED Requirements

### Requirement: Reserva administrativa multi-habitación
El sistema SHALL permitir a un administrador autorizado crear una reserva manual para una o más habitaciones, con capacidad y disponibilidad validadas contra los datos vigentes al confirmar, tanto en el contexto mock como en producción persistente. Las fechas de la estadía SHALL validarse únicamente contra la invariante de intervalo del dominio —salida posterior a entrada—, sin exigir que estén en el presente o el futuro.

#### Scenario: Creación disponible para varias habitaciones
- **WHEN** el administrador selecciona fechas válidas y varias habitaciones disponibles
- **THEN** el sistema crea una única reserva confirmada con todos los ítems de habitación y una referencia pública segura

#### Scenario: Conflicto de disponibilidad
- **WHEN** una de las habitaciones deja de estar disponible antes de confirmar
- **THEN** el sistema no crea ninguna parte de la reserva y comunica el conflicto sin aceptar disponibilidad enviada por el cliente

#### Scenario: Creación persistente autorizada
- **WHEN** un administrador autorizado confirma una reserva válida en producción
- **THEN** el sistema persiste huésped, reserva, ítems, pago pendiente y evento de notificación mediante una única operación transaccional

#### Scenario: Fallo durante la persistencia
- **WHEN** falla la creación de cualquier elemento de una reserva manual en producción
- **THEN** el sistema revierte huésped, reserva, ítems, pago y outbox asociados sin dejar datos parciales
