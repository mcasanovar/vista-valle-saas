# reservation-administration Specification

## Purpose

Darle una visual amigable y funcional a la seccion de administracion de reservas en el dashboard de administrador

## Requirements

### Requirement: Gestión de reservas

El sistema SHALL permitir listar, buscar, filtrar, consultar, modificar fechas de estadía en cualquier reserva independientemente de su origen o estado, y cambiar el estado de una reserva a cancelada, completada o no presentada, exclusivamente contra los datos de producción. Editar las fechas de una reserva SHALL NOT modificar su estado. El listado SHALL presentarse paginado, con las reservas más recientemente creadas primero por defecto. El sistema SHALL permitir buscar por texto libre sobre nombre, apellido, email, teléfono, RUT y empresa del huésped, el identificador público de la reserva, y el nombre de la o las habitaciones asociadas, sin considerar el comentario libre del huésped. El sistema SHALL permitir filtrar por fecha de llegada y, opcionalmente, por fecha de salida, cada una admitiendo tanto una fecha exacta como un rango de fechas. El detalle de una reserva SHALL identificar todas sus habitaciones, subtotales, total agregado, el o los pagos asociados con su estado, y, cuando exista, la solicitud de factura sin exponer antecedentes tributarios innecesarios. El detalle SHALL ofrecer controles de edición de fechas y de datos de contacto del huésped para cualquier reserva, sin condicionarlos a su origen o estado, y SHALL mostrar el resultado financiero recalculado, los saldos pendientes y los sobrepagos pendientes de resolución manual. El sistema SHALL permitir cancelar una reserva confirmada independientemente de si su fecha de llegada ya pasó.

#### Scenario: Marcar no presentación

- **WHEN** el administrador marca una reserva confirmada como no presentada
- **THEN** el sistema conserva la reserva, registra el nuevo estado y su autoría

#### Scenario: Consulta de reserva con varias habitaciones

- **WHEN** el administrador abre una reserva que contiene varias habitaciones
- **THEN** puede identificar todos sus ítems y las fechas comunes para operar y completar el bloqueo manual de canales

#### Scenario: Búsqueda por cualquier campo del huésped o la reserva

- **WHEN** el administrador escribe un término de búsqueda que coincide con el nombre, apellido, email, teléfono, RUT o empresa de un huésped, con el identificador público de una reserva, o con el nombre de una habitación reservada
- **THEN** el sistema muestra únicamente las reservas que coinciden, sin considerar el comentario libre del huésped como campo de búsqueda

#### Scenario: Filtro por fecha exacta de llegada

- **WHEN** el administrador filtra por una única fecha de llegada
- **THEN** el sistema muestra solo las reservas cuya fecha de llegada coincide exactamente con esa fecha

#### Scenario: Filtro por rango de fechas de llegada

- **WHEN** el administrador filtra por un rango de fechas de llegada
- **THEN** el sistema muestra las reservas cuya fecha de llegada cae dentro de ese rango, inclusive en ambos extremos

#### Scenario: Filtro combinado de llegada y salida

- **WHEN** el administrador aplica un filtro de fecha de llegada y, adicionalmente, un filtro de fecha de salida (exacta o en rango)
- **THEN** el sistema muestra solo las reservas que satisfacen ambos filtros a la vez

#### Scenario: Listado paginado

- **WHEN** el número de reservas que coinciden con los filtros activos excede el tamaño de página
- **THEN** el sistema divide los resultados en páginas y permite navegar entre ellas sin alterar el orden ni omitir o duplicar reservas entre páginas, incluidas las reservas con varias habitaciones

#### Scenario: Detalle con pagos y factura

- **WHEN** el administrador abre el detalle de una reserva que tiene al menos un pago registrado y, opcionalmente, una solicitud de factura
- **THEN** el sistema muestra el o los pagos con su estado y monto, y, si existe la solicitud de factura, sus datos, sin exponer antecedentes tributarios que la reserva no haya registrado

#### Scenario: Edición disponible para una reserva propia sin importar su estado

- **WHEN** el administrador abre una reserva con origen website, teléfono, WhatsApp o administración, sin importar si está confirmada, cancelada, completada o marcada como no presentada
- **THEN** el detalle muestra las acciones para editar `check-in`, `check-out` y los datos de contacto del huésped, y la edición no altera el estado de la reserva

#### Scenario: Edición bloqueada para una reserva de canal externo

- **WHEN** el administrador abre una reserva con origen Airbnb o Booking
- **THEN** el detalle ya no bloquea la edición por ese origen: muestra las mismas acciones para editar `check-in`, `check-out` y los datos de contacto del huésped que para una reserva de origen propio, sin alterar el estado de la reserva

#### Scenario: Cancelación de una reserva con fecha de llegada pasada

- **WHEN** el administrador cancela una reserva confirmada cuya fecha de llegada ya transcurrió
- **THEN** el sistema permite la cancelación de la misma forma que para una reserva cuya fecha de llegada aún no ocurre

#### Scenario: Detalle muestra el comentario del huésped

- **WHEN** el administrador abre el detalle de una reserva que tiene un comentario registrado por el huésped
- **THEN** el sistema muestra ese comentario en el detalle, aunque no participe en la búsqueda por texto libre

### Requirement: Edición de datos de contacto del huésped

El sistema SHALL permitir a un administrador editar el nombre, apellido, correo electrónico y teléfono del huésped de cualquier reserva, sin importar su origen ni su estado, y SHALL validar el formato del correo y del teléfono antes de guardar. Esta edición SHALL NOT alterar fechas, precios, pagos ni el estado de la reserva.

#### Scenario: Corrección de datos de contacto en una reserva confirmada

- **WHEN** el administrador corrige el correo o el teléfono del huésped de una reserva confirmada
- **THEN** el sistema guarda el nuevo dato, lo refleja en el detalle, y no modifica fechas, precios ni estado

#### Scenario: Edición de datos de contacto en una reserva de Airbnb o Booking

- **WHEN** el administrador corrige el nombre, apellido, correo o teléfono del huésped de una reserva originada en Airbnb o Booking
- **THEN** el sistema aplica el cambio de la misma forma que en una reserva de origen propio, sin rechazarlo por el origen del canal

#### Scenario: Dato de contacto inválido

- **WHEN** el administrador intenta guardar un correo o un teléfono con formato inválido
- **THEN** el sistema rechaza el guardado, muestra el motivo y conserva el dato anterior

### Requirement: Registro de pago presencial

El sistema SHALL permitir marcar como recibido el pago de una reserva de pago al llegar, registrando monto, fecha, medio y administrador responsable, en cualquier momento posterior a la creación de la reserva, incluso después de finalizada la estadía. Esta acción SHALL aplicar únicamente a reservas con modalidad de pago al llegar; SHALL NOT estar disponible para reservas pagadas en línea, cuyo estado de pago se gestiona automáticamente por el proveedor de pago.

#### Scenario: Pago al check-in

- **WHEN** el administrador registra el pago completo de una reserva pendiente
- **THEN** el estado financiero refleja el pago recibido sin alterar incorrectamente las fechas de la reserva

#### Scenario: Pago registrado días después de la estadía

- **WHEN** el administrador registra el pago de una reserva de pago al llegar cuya fecha de salida ya transcurrió
- **THEN** el sistema acepta el registro del pago sin restricción de fecha

#### Scenario: Intento de registrar pago presencial en una reserva pagada en línea

- **WHEN** el administrador intenta registrar un pago presencial sobre una reserva pagada en línea
- **THEN** el sistema no ofrece esa acción para esa reserva

### Requirement: Bloqueos de habitación

El sistema SHALL permitir a un administrador autorizado crear y retirar bloqueos sin representarlos como reservas ficticias. La creación SHALL aceptar una o más habitaciones distintas, un único intervalo de alojamiento y un motivo; SHALL validar las habitaciones y el intervalo en el servidor; y SHALL crear todos los bloqueos o ninguno después de la confirmación explícita del administrador cuando existan conflictos. Antes de escribir, el sistema SHALL revisar la disponibilidad vigente en el servidor y, si corresponde, mostrar cada fecha afectada y las habitaciones seleccionadas que tienen una reserva, retención o bloqueo incompatible. Una confirmación explícita SHALL crear los bloqueos solicitados para todas las habitaciones seleccionadas, incluso las que tengan conflicto, sin modificar ni cancelar las reservas, retenciones o bloqueos existentes. Cada habitación SHALL conservar su propio bloqueo, motivo y trazabilidad. El panel SHALL listar bloqueos activos y retirados, permitir filtrar por habitación, intervalo, texto de motivo y estado, y mostrar el detalle de las fechas, motivo y auditoría de cada bloqueo. Un bloqueo activo SHALL retirarse mediante confirmación explícita; editarlo SHALL consistir en retirarlo y crear un nuevo bloqueo, manteniendo ambos eventos auditables.

#### Scenario: Mantenimiento de una habitación

- **WHEN** el administrador selecciona una habitación disponible, un intervalo válido y el motivo de mantenimiento
- **THEN** el sistema crea un bloqueo para esa habitación, la excluye de disponibilidad durante el intervalo y registra su creación

#### Scenario: Creación para varias habitaciones

- **WHEN** el administrador selecciona varias habitaciones disponibles con un mismo intervalo y motivo
- **THEN** el sistema crea un bloqueo individual para cada habitación como una única operación y muestra las habitaciones afectadas

#### Scenario: Revisión de conflicto por fecha y habitación

- **WHEN** una o más habitaciones seleccionadas tienen una reserva, retención o bloqueo incompatible en una o más fechas del intervalo
- **THEN** el sistema no escribe bloqueos, muestra cada fecha afectada junto con las habitaciones seleccionadas que están agendadas y ofrece confirmar o cancelar la operación

#### Scenario: Confirmación explícita de bloqueo con conflictos

- **WHEN** el administrador confirma la revisión de conflictos
- **THEN** el sistema revalida autorización, habitaciones e intervalo en el servidor y crea, dentro de una única operación, un bloqueo para cada habitación seleccionada y todo el intervalo, incluso en fechas con reservas, retenciones o bloqueos, sin modificar ni cancelar esos registros existentes y dejando auditoría de la confirmación

#### Scenario: Cancelación de revisión de conflictos

- **WHEN** el administrador cancela la revisión de conflictos
- **THEN** el sistema no crea bloqueos ni altera reservas, retenciones, disponibilidad o auditoría

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

### Requirement: Acceso administrativo protegido
El sistema SHALL exigir autenticación a una cuenta administrativa autorizada para acceder a datos de huéspedes y ejecutar operaciones del panel, sin ofrecer registro público de administradores.

#### Scenario: Visitante no autenticado
- **WHEN** una persona no autenticada solicita una ruta administrativa
- **THEN** el sistema impide el acceso y solicita autenticación

### Requirement: Calendario operativo
El sistema SHALL presentar por habitación las reservas, retenciones relevantes y bloqueos en una vista de calendario que permita identificar disponibilidad y origen.

#### Scenario: Revisión de una fecha
- **WHEN** el administrador consulta una fecha del calendario
- **THEN** puede distinguir disponibilidad, reserva, retención o bloqueo y abrir su detalle

### Requirement: Reservas manuales multicanal
El sistema SHALL permitir crear reservas manuales indicando como origen Airbnb, Booking, teléfono, WhatsApp o administración, aplicando las mismas validaciones de disponibilidad que una reserva web.

#### Scenario: Ingreso de reserva de Booking
- **WHEN** el administrador ingresa una reserva de Booking para una habitación disponible
- **THEN** el sistema la confirma y bloquea esas fechas para nuevas reservas web

#### Scenario: Reserva externa superpuesta
- **WHEN** el administrador intenta ingresar una reserva externa que se superpone con otra ocupación
- **THEN** el sistema rechaza la creación y muestra el conflicto existente

### Requirement: Control de sincronización manual
El sistema SHALL marcar cada reserva web confirmada como pendiente de bloqueo externo y permitir registrar por separado que Airbnb y Booking fueron bloqueados.

#### Scenario: Nueva reserva web
- **WHEN** se confirma una reserva originada en el sitio
- **THEN** el panel la muestra en una cola visible con Airbnb y Booking pendientes

#### Scenario: Bloqueos externos completados
- **WHEN** el administrador confirma que bloqueó ambas plataformas
- **THEN** la reserva deja de aparecer como pendiente de sincronización manual y conserva quién y cuándo completó la tarea

### Requirement: Auditoría administrativa
El sistema SHALL registrar actor, fecha y cambio para operaciones sensibles sobre reservas, pagos, bloqueos y sincronización manual.

#### Scenario: Cancelación administrativa
- **WHEN** un administrador cancela una reserva
- **THEN** el sistema conserva un evento de auditoría con el estado anterior, el nuevo estado y el responsable

### Requirement: Autenticación administrativa aislada en contexto mock
El sistema SHALL ofrecer sesiones administrativas simuladas y persistencia controlada bajo un contexto mock explícito para validar el panel sin conectarse a Supabase Auth ni a una base externa, sin permitir que esas identidades sean aceptadas en producción.

#### Scenario: Validación local del panel
- **WHEN** se prueba una ruta administrativa bajo el contexto mock
- **THEN** el sistema utiliza una identidad controlada y adaptadores locales, aplica las mismas fronteras de autorización configuradas y no realiza solicitudes de red

