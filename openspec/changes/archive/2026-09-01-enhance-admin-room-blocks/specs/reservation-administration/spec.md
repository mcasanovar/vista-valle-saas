## MODIFIED Requirements

### Requirement: Bloqueos de habitación
El sistema SHALL permitir a un administrador autorizado crear y retirar bloqueos sin representarlos como reservas ficticias. La creación SHALL aceptar una o más habitaciones distintas, un único intervalo de alojamiento y un motivo; SHALL validar las habitaciones, el intervalo y los conflictos contra la disponibilidad vigente en el servidor; y SHALL crear todos los bloqueos o ninguno. Cada habitación SHALL conservar su propio bloqueo, motivo y trazabilidad. El panel SHALL listar bloqueos activos y retirados, permitir filtrar por habitación, intervalo, texto de motivo y estado, y mostrar el detalle de las fechas, motivo y auditoría de cada bloqueo. Un bloqueo activo SHALL retirarse mediante confirmación explícita; editarlo SHALL consistir en retirarlo y crear un nuevo bloqueo, manteniendo ambos eventos auditables.

#### Scenario: Mantenimiento de una habitación
- **WHEN** el administrador selecciona una habitación disponible, un intervalo válido y el motivo de mantenimiento
- **THEN** el sistema crea un bloqueo para esa habitación, la excluye de disponibilidad durante el intervalo y registra su creación

#### Scenario: Creación para varias habitaciones
- **WHEN** el administrador selecciona varias habitaciones disponibles con un mismo intervalo y motivo
- **THEN** el sistema crea un bloqueo individual para cada habitación como una única operación y muestra las habitaciones afectadas

#### Scenario: Conflicto en una habitación seleccionada
- **WHEN** una de varias habitaciones seleccionadas tiene una reserva, retención o bloqueo incompatible al confirmar
- **THEN** el sistema no crea ningún bloqueo de la selección, identifica el conflicto sin confiar en disponibilidad enviada por el cliente y conserva sin cambios las demás habitaciones

#### Scenario: Creación iniciada desde el calendario
- **WHEN** el administrador inicia un bloqueo desde una fecha o celda de habitación vacía del calendario
- **THEN** el formulario de bloqueos muestra la fecha y, cuando corresponda, la habitación precargadas antes de la confirmación

#### Scenario: Consulta de bloqueos activos y retirados
- **WHEN** el administrador filtra bloqueos por habitación, intervalo, motivo o estado
- **THEN** el panel presenta únicamente los bloqueos que satisfacen todos los filtros y distingue claramente los activos de los retirados

#### Scenario: Detalle y auditoría de bloqueo
- **WHEN** el administrador abre el detalle de un bloqueo
- **THEN** el sistema muestra habitación, intervalo, noches, motivo, creador y fecha de creación, además del responsable y fecha de retiro cuando el bloqueo ya no está activo

#### Scenario: Retiro confirmado de un bloqueo
- **WHEN** el administrador confirma explícitamente el retiro de un bloqueo activo
- **THEN** el sistema libera su intervalo de disponibilidad, conserva el bloqueo como retirado y registra quién lo retiró y cuándo

#### Scenario: Retiro cancelado
- **WHEN** el administrador cancela la confirmación de retiro
- **THEN** el sistema mantiene el bloqueo activo y no altera disponibilidad ni auditoría

#### Scenario: Motivo sugerido o libre
- **WHEN** el administrador elige un motivo sugerido o escribe un motivo libre no vacío
- **THEN** el sistema conserva el texto elegido como motivo del bloqueo y lo muestra en su detalle y listado
