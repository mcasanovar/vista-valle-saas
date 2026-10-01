## MODIFIED Requirements

### Requirement: Gestión de reservas

El sistema SHALL permitir listar, buscar, filtrar, consultar, modificar la estadía —fechas, conjunto de habitaciones y cantidad de personas por habitación— en cualquier reserva independientemente de su origen o estado, y cambiar el estado de una reserva a cancelada, completada o no presentada, exclusivamente contra los datos de producción. Editar la estadía de una reserva SHALL NOT modificar su estado. El listado SHALL presentarse paginado, con las reservas más recientemente creadas primero por defecto. El sistema SHALL permitir buscar por texto libre sobre nombre, apellido, email, teléfono, RUT y empresa del huésped, el identificador público de la reserva, y el nombre de la o las habitaciones asociadas, sin considerar el comentario libre del huésped. El sistema SHALL permitir filtrar por fecha de llegada y, opcionalmente, por fecha de salida, cada una admitiendo tanto una fecha exacta como un rango de fechas. El detalle de una reserva SHALL identificar todas sus habitaciones, la cantidad de personas de cada una, subtotales, total agregado, el o los pagos asociados con su estado, y, cuando exista, la solicitud de factura sin exponer antecedentes tributarios innecesarios. El detalle SHALL ofrecer un control de edición de estadía y un control de edición de datos de contacto del huésped para cualquier reserva, sin condicionarlos a su origen o estado, y SHALL mostrar el resultado financiero recalculado, los saldos pendientes y los sobrepagos pendientes de resolución manual. El sistema SHALL permitir cancelar una reserva confirmada independientemente de si su fecha de llegada ya pasó.

#### Scenario: Marcar no presentación

- **WHEN** el administrador marca una reserva confirmada como no presentada
- **THEN** el sistema conserva la reserva, registra el nuevo estado y su autoría

#### Scenario: Consulta de reserva con varias habitaciones

- **WHEN** el administrador abre una reserva que contiene varias habitaciones
- **THEN** puede identificar todos sus ítems, la cantidad de personas de cada uno y las fechas comunes para operar y completar el bloqueo manual de canales

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
- **THEN** el detalle muestra las acciones para editar la estadía —`check-in`, `check-out`, habitaciones y personas por habitación— y los datos de contacto del huésped, y la edición no altera el estado de la reserva

#### Scenario: Edición bloqueada para una reserva de canal externo

- **WHEN** el administrador abre una reserva con origen Airbnb o Booking
- **THEN** el detalle ya no bloquea la edición por ese origen: muestra las mismas acciones para editar la estadía y los datos de contacto del huésped que para una reserva de origen propio, sin alterar el estado de la reserva

#### Scenario: Edición de fechas y habitaciones en una sola operación

- **WHEN** el administrador necesita mover las fechas de una reserva y además cambiar sus habitaciones
- **THEN** el detalle le permite enviar ambos cambios en una única edición de estadía, que produce un solo recálculo financiero, un solo registro de auditoría y una sola comunicación administrativa

#### Scenario: Cancelación de una reserva con fecha de llegada pasada

- **WHEN** el administrador cancela una reserva confirmada cuya fecha de llegada ya transcurrió
- **THEN** el sistema permite la cancelación de la misma forma que para una reserva cuya fecha de llegada aún no ocurre

#### Scenario: Detalle muestra el comentario del huésped

- **WHEN** el administrador abre el detalle de una reserva que tiene un comentario registrado por el huésped
- **THEN** el sistema muestra ese comentario en el detalle, aunque no participe en la búsqueda por texto libre

### Requirement: Auditoría administrativa
El sistema SHALL registrar actor, fecha y cambio para operaciones sensibles sobre reservas, pagos, bloqueos y sincronización manual. El cambio de estadía de una reserva SHALL constar entre esas operaciones, registrando la diferencia de fechas, de habitaciones y de cantidad de personas por habitación.

#### Scenario: Cancelación administrativa
- **WHEN** un administrador cancela una reserva
- **THEN** el sistema conserva un evento de auditoría con el estado anterior, el nuevo estado y el responsable

#### Scenario: Cancelación administrativa con pagos asociados
- **WHEN** un administrador cancela una reserva que tiene uno o más pagos asociados
- **THEN** el sistema conserva, además del evento de auditoría de la reserva, un evento de auditoría por cada pago cancelado automáticamente, con su estado anterior, su nuevo estado (`cancelled`) y el responsable

#### Scenario: Cambio de estadía de una reserva
- **WHEN** un administrador confirma una edición de estadía que cambia fechas, habitaciones o cantidad de personas por habitación
- **THEN** el sistema conserva un único evento de auditoría que identifica al responsable, las fechas anteriores y nuevas, las habitaciones que entran y salen, y la cantidad de personas anterior y nueva por habitación
